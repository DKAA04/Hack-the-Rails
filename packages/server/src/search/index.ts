import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  SearchIntentSchema,
  SearchResultSchema,
  type SearchIntent,
  type SearchReceipt,
  type SearchResult,
} from "@wayward/contracts";
import { configuration, credentialsPresent } from "../config";
import { ServiceError } from "../errors";
import { getRecord, putRecord } from "../db/records";
import { searchFlights } from "../providers/duffel/search";
import { searchTransit } from "../providers/public-transit/search";
export const StoredSearchSchema = z.object({
  intent: SearchIntentSchema,
  result: SearchResultSchema,
});
export async function storedSearch(id: string) {
  const raw = await getRecord("search", id);
  if (!raw) throw new ServiceError("NOT_FOUND", "Search not found.", 404);
  return StoredSearchSchema.parse(raw);
}
export async function search(input: SearchIntent): Promise<SearchReceipt> {
  const intent = SearchIntentSchema.parse(input);
  const config = configuration();
  if (!config.valid)
    throw new ServiceError(
      "NOT_CONFIGURED",
      "Invalid WAYWARD_ENV configuration.",
      503,
    );
  // ISO comparison without relying on locale-specific field ordering.
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: intent.origin.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  if (intent.departureDate < `${date.year}-${date.month}-${date.day}`)
    throw new ServiceError(
      "INVALID_REQUEST",
      "Departure date is in the past at the origin.",
      400,
    );
  const searchId = randomUUID();
  const now = new Date().toISOString();
  const result: SearchResult = {
    searchId,
    state: "pending",
    createdAt: now,
    offers: [],
    warnings: [],
    timetableJourneys: [],
    providerStatuses: [],
    updatedAt: now,
  };
  // Never persist discount card references in search history.
  const safeIntent = {
    ...intent,
    passengers: intent.passengers.map((p) => ({
      ...p,
      discounts: p.discounts.map((d) => ({ ...d, cardReference: null })),
    })),
  };
  await putRecord("search", searchId, { intent: safeIntent, result });
  const jobs: { provider: string; run: () => Promise<void> }[] = [];
  if (intent.modes.includes("flight")) {
    if (credentialsPresent("DUFFEL_ACCESS_TOKEN"))
      jobs.push({
        provider: "duffel",
        run: async () => {
          const data = await searchFlights(intent);
          result.offers.push(...data.offers);
          result.warnings.push(...data.warnings);
        },
      });
    else
      result.providerStatuses!.push({
        provider: "duffel",
        status: "unconfigured",
        message: "DUFFEL_ACCESS_TOKEN is missing.",
      });
  }
  if (
    intent.modes.some((m) =>
      ["rail", "local_transit", "walking", "transfer", "ferry"].includes(m),
    )
  )
    jobs.push({
      provider: "public-transit",
      run: async () => {
        const data = await searchTransit(intent);
        result.timetableJourneys!.push(
          ...data.itineraries.map((itinerary) => ({
            itinerary,
            source: "vbb",
            attribution:
              "VBB timetable data via community transport.rest; no booking or price guarantee",
            price: { kind: "unknown" as const },
            availability: "unknown" as const,
            bookingSupported: false as const,
          })),
        );
        result.warnings.push(...data.warnings);
      },
    });
  for (const [provider, modes] of [
    ["all-aboard", ["rail"]],
    ["distribusion", ["coach", "rail", "ferry"]],
    ["omio", ["flight", "rail", "coach", "ferry"]],
  ] as const) {
    if (intent.modes.some((m) => (modes as readonly string[]).includes(m)))
      result.providerStatuses!.push({
        provider,
        status: "unsupported",
        message: "Supplier adapter and partner access are not yet implemented.",
      });
  }
  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  let successful = 0;
  for (const [i, r] of settled.entries()) {
    const provider = jobs[i]!.provider;
    if (r.status === "fulfilled") {
      successful++;
      result.providerStatuses!.push({
        provider,
        status: "complete",
        message: null,
      });
    } else {
      const error =
        r.reason instanceof ServiceError
          ? r.reason
          : new ServiceError(
              "PROVIDER_UNAVAILABLE",
              "Supplier response could not be normalized.",
              503,
              true,
            );
      result.providerStatuses!.push({
        provider,
        status:
          error.code === "NOT_CONFIGURED"
            ? "unconfigured"
            : error.code === "NOT_IMPLEMENTED"
              ? "unsupported"
              : "failed",
        message: error.message,
      });
    }
  }
  result.warnings.push(
    ...result
      .providerStatuses!.filter((p) => p.status !== "complete")
      .map((p) => `${p.provider}: ${p.message}`),
  );
  result.state =
    successful === 0
      ? "failed"
      : result.providerStatuses!.some((p) => p.status !== "complete")
        ? "partial"
        : "complete";
  // Total-aware sorting never compares different currencies or ranks unknown prices as zero.
  if (intent.preferences.sort === "cheapest")
    result.offers.sort((a, b) => {
      if (
        !("total" in a.price) ||
        !("total" in b.price) ||
        a.price.total.currency !== b.price.total.currency
      )
        return 0;
      return a.price.total.amount - b.price.total.amount;
    });
  else if (intent.preferences.sort === "fastest")
    result.offers.sort((a, b) => duration(a) - duration(b));
  else
    result.offers.sort(
      (a, b) => a.itinerary.transfers.length - b.itinerary.transfers.length,
    );
  result.updatedAt = new Date().toISOString();
  await putRecord("search", searchId, {
    intent: safeIntent,
    result: SearchResultSchema.parse(result),
  });
  return { searchId, state: result.state, createdAt: result.createdAt };
}
function duration(offer: SearchResult["offers"][number]) {
  return (
    Date.parse(offer.itinerary.legs.at(-1)!.arrivalUtc) -
    Date.parse(offer.itinerary.legs[0]!.departureUtc)
  );
}
export async function getSearch(id: string): Promise<SearchResult> {
  const stored = await storedSearch(id);
  if (
    stored.result.state === "pending" &&
    Date.parse(stored.result.createdAt) < Date.now() - 120000
  ) {
    stored.result.state = "failed";
    stored.result.warnings.push(
      "Search processing was interrupted. Start a new search.",
    );
    stored.result.updatedAt = new Date().toISOString();
    await putRecord("search", id, stored);
  }
  return stored.result;
}
