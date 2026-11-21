import {
  type SearchIntent,
  type RevalidationResponse,
  type CreateOrderRequest,
  type Offer,
} from "@wayward/contracts";
import { configuration } from "../config";
import { ServiceError } from "../errors";
export function validateOrderQuote(
  quote: RevalidationResponse,
  intent: SearchIntent,
  request: CreateOrderRequest,
): Offer {
  if (!configuration().valid)
    throw new ServiceError(
      "NOT_CONFIGURED",
      "Invalid WAYWARD_ENV configuration.",
      503,
    );
  if (Date.parse(quote.expiresAt) <= Date.now())
    throw new ServiceError(
      "QUOTE_EXPIRED",
      "Quote expired. Revalidate before creating an order.",
      409,
    );
  if (quote.status === "unavailable")
    throw new ServiceError(
      "CONFLICT",
      "This quote is no longer available.",
      409,
    );
  if (quote.requiresAcceptance && !request.acceptChanges)
    throw new ServiceError(
      "CONFLICT",
      "Price or itinerary changed. Explicitly accept the refreshed quote.",
      409,
    );
  if (quote.offers.length !== 1)
    throw new ServiceError(
      "NOT_IMPLEMENTED",
      "Multi-supplier ordering requires coordinated booking and compensation; it is not enabled.",
      501,
    );
  const offer = quote.offers[0]!;
  if (
    offer.availability !== "available" ||
    offer.freshness.state !== "fresh" ||
    !offer.freshness.expiresAt ||
    Date.parse(offer.freshness.expiresAt) <= Date.now()
  )
    throw new ServiceError(
      "QUOTE_EXPIRED",
      "Offer availability or freshness cannot be confirmed.",
      409,
    );
  if (
    !["live_offer", "test_offer"].includes(offer.price.kind) ||
    !("completeness" in offer.price) ||
    offer.price.completeness !== "complete"
  )
    throw new ServiceError(
      "CONFLICT",
      "A complete supplier offer total is required. Partial, indicative and unknown prices cannot be ordered.",
      409,
    );
  if (
    offer.environment !==
    (configuration().environment === "live" ? "live" : "test")
  )
    throw new ServiceError(
      "CONFLICT",
      "Offer environment does not match application environment.",
      409,
    );
  if (
    offer.itinerary.completeness !== "complete" ||
    offer.itinerary.compatibility !== "verified"
  )
    throw new ServiceError(
      "CONFLICT",
      "Unverified or incomplete connections cannot be ordered.",
      409,
    );
  const passengers = (p: SearchIntent["passengers"]) =>
    JSON.stringify(
      p
        .map((v) => ({
          id: v.id,
          age: v.age,
          discounts: v.discounts.map((d) => ({
            scheme: d.scheme,
            provider: d.provider,
          })),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
  if (passengers(request.passengers) !== passengers(intent.passengers))
    throw new ServiceError(
      "CONFLICT",
      "Passengers differ from the revalidated search. Search again.",
      409,
    );
  return offer;
}
