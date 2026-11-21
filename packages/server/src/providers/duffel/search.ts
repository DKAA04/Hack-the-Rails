import { z } from "zod";
import type { Place, SearchIntent, Offer } from "@wayward/contracts";
import { configuration } from "../../config";
import { ServiceError } from "../../errors";
import { DuffelPlaceSchema } from "../../places";
import { duffelJson } from "./client";
import { DuffelOfferSchema, normalizeFlight } from "./normalize";
import { markConnectivity } from "../connectivity";
async function iata(place: Place) {
  const code = place.providerIds.find((p) => p.provider === "iata")?.id;
  if (code && /^[A-Z]{3}$/.test(code)) return code;
  const data = z
    .object({ data: z.array(DuffelPlaceSchema) })
    .parse(
      await duffelJson(
        `/places/suggestions?query=${encodeURIComponent(place.name)}`,
      ),
    );
  const matches = data.data.filter(
    (p) =>
      p.type === "city" &&
      p.name.toLocaleLowerCase() === place.name.toLocaleLowerCase() &&
      p.iata_country_code === place.countryCode,
  );
  if (matches.length !== 1)
    throw new ServiceError(
      "INVALID_REQUEST",
      "Choose an unambiguous Duffel city or airport from place lookup for flight search.",
      400,
    );
  return matches[0]!.iata_code;
}
function assertEnvironment(live: boolean) {
  if (live !== (configuration().environment === "live"))
    throw new ServiceError(
      "CONFLICT",
      "Duffel account environment does not match WAYWARD_ENV; result rejected.",
      409,
    );
}
export async function searchFlights(
  intent: SearchIntent,
): Promise<{ offers: Offer[]; warnings: string[] }> {
  if (intent.passengers.length > 9)
    throw new ServiceError(
      "INVALID_REQUEST",
      "Duffel supports at most nine passengers per search.",
      400,
    );
  if (intent.passengers.some((p) => p.discounts.length))
    throw new ServiceError(
      "NOT_IMPLEMENTED",
      "Flight discount-card pricing is not implemented. Remove discounts or select another mode.",
      501,
    );
  try {
    const [origin, destination] = await Promise.all([
      iata(intent.origin),
      iata(intent.destination),
    ]);
    const slices = [
      { origin, destination, departure_date: intent.departureDate },
      ...(intent.returnDate
        ? [
            {
              origin: destination,
              destination: origin,
              departure_date: intent.returnDate,
            },
          ]
        : []),
    ];
    const raw = z
      .object({
        data: z.object({
          live_mode: z.boolean(),
          offers: z.array(z.unknown()),
        }),
      })
      .parse(
        await duffelJson(
          "/air/offer_requests?return_offers=true&supplier_timeout=6000",
          {
            data: {
              slices,
              passengers: intent.passengers.map((p) => ({ age: p.age })),
              ...(intent.preferences.cabin
                ? {
                    cabin_class:
                      intent.preferences.cabin === "premium"
                        ? "premium_economy"
                        : intent.preferences.cabin,
                  }
                : {}),
            },
          },
        ),
      );
    assertEnvironment(raw.data.live_mode);
    const offers: Offer[] = [];
    let omitted = 0;
    for (const item of raw.data.offers) {
      try {
        const offer = DuffelOfferSchema.parse(item);
        assertEnvironment(offer.live_mode);
        const normalized = normalizeFlight(offer, intent);
        if (
          intent.preferences.maxTransfers !== null &&
          normalized.itinerary.transfers.length >
            intent.preferences.maxTransfers
        ) {
          omitted++;
          continue;
        }
        offers.push(normalized);
      } catch (error) {
        if (error instanceof ServiceError && error.code === "CONFLICT")
          throw error;
        omitted++;
      }
    }
    markConnectivity("duffel", "verified");
    return {
      offers,
      warnings: [
        ...(omitted
          ? [
              `${omitted} flight offers omitted because of unsupported data, missing time zones, ambiguous DST timestamps or transfer limits.`,
            ]
          : []),
        ...(intent.preferences.accessible
          ? [
              "Flight accessibility assistance is not confirmed by search; arrange with supplier before purchase.",
            ]
          : []),
      ],
    };
  } catch (error) {
    markConnectivity("duffel", "failed");
    throw error;
  }
}
export async function repriceFlight(
  offer: Offer,
  intent: SearchIntent,
): Promise<Offer> {
  try {
    const data = z
      .object({ data: DuffelOfferSchema })
      .parse(
        await duffelJson(
          `/air/offers/${encodeURIComponent(offer.providerOfferId)}?return_available_services=true`,
        ),
      );
    assertEnvironment(data.data.live_mode);
    if (data.data.id !== offer.providerOfferId)
      throw new ServiceError(
        "PROVIDER_UNAVAILABLE",
        "Supplier returned a different offer.",
        503,
      );
    const normalized = normalizeFlight(data.data, intent);
    markConnectivity("duffel", "verified");
    return normalized;
  } catch (error) {
    markConnectivity("duffel", "failed");
    throw error;
  }
}
