import { randomUUID } from "node:crypto";
import {
  RevalidationRequestSchema,
  RevalidationResponseSchema,
  type RevalidationRequest,
  type RevalidationResponse,
} from "@wayward/contracts";
import { ServiceError } from "../errors";
import { putRecord } from "../db/records";
import { storedSearch } from "../search";
import { repriceFlight } from "../providers/duffel/search";
export async function revalidate(
  input: RevalidationRequest,
): Promise<RevalidationResponse> {
  const request = RevalidationRequestSchema.parse(input);
  if (new Set(request.offerIds).size !== request.offerIds.length)
    throw new ServiceError(
      "INVALID_REQUEST",
      "Duplicate offer IDs are not allowed.",
      400,
    );
  const stored = await storedSearch(request.searchId);
  const originals = request.offerIds.map((id) => {
    const offer = stored.result.offers.find((o) => o.id === id);
    if (!offer)
      throw new ServiceError(
        "NOT_FOUND",
        "Offer not found in this search. Timetable journeys cannot be repriced or purchased.",
        404,
      );
    return offer;
  });
  if (originals.some((o) => o.provider !== "duffel"))
    throw new ServiceError(
      "NOT_IMPLEMENTED",
      "Repricing is not implemented for the selected provider.",
      501,
    );
  // Refresh independently, but do not manufacture a shared total or protected multi-supplier quote.
  const offers = await Promise.all(
    originals.map((o) => repriceFlight(o, stored.intent)),
  );
  const expires = offers
    .map((o) => o.freshness.expiresAt)
    .filter((v): v is string => v !== null);
  if (
    expires.length !== offers.length ||
    expires.some((v) => Date.parse(v) <= Date.now())
  )
    throw new ServiceError(
      "QUOTE_EXPIRED",
      "Supplier offer is expired or expiry is unknown. Search again.",
      409,
    );
  const changed = offers.some(
    (o, i) =>
      JSON.stringify(
        o.price.kind !== "unknown" && "total" in o.price ? o.price.total : null,
      ) !==
        JSON.stringify(
          "total" in originals[i]!.price ? originals[i]!.price.total : null,
        ) ||
      JSON.stringify(
        o.itinerary.legs.map((l) => [
          l.origin.id,
          l.destination.id,
          l.departureUtc,
          l.arrivalUtc,
        ]),
      ) !==
        JSON.stringify(
          originals[i]!.itinerary.legs.map((l) => [
            l.origin.id,
            l.destination.id,
            l.departureUtc,
            l.arrivalUtc,
          ]),
        ),
  );
  const unavailable = offers.some((o) => o.availability !== "available");
  const quote = RevalidationResponseSchema.parse({
    quoteId: randomUUID(),
    status: unavailable ? "unavailable" : changed ? "changed" : "valid",
    offers,
    expiresAt: expires.sort()[0],
    requiresAcceptance: changed,
  });
  await putRecord("quote", quote.quoteId, {
    quote,
    intent: stored.intent,
    searchId: request.searchId,
  });
  return quote;
}
