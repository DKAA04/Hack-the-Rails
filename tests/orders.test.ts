import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OfferSchema,
  type SearchIntent,
  type RevalidationResponse,
  type CreateOrderRequest,
} from "../packages/contracts/src/index";
import { validateOrderQuote } from "../packages/server/src/orders/validation";
function fixture() {
  const place = {
    id: "test:place",
    name: "TEST FIXTURE",
    kind: "airport" as const,
    countryCode: "FR",
    timeZone: "Europe/Paris",
    providerIds: [{ provider: "test", id: "opaque" }],
    coordinates: null,
  };
  const passengers = [{ id: "p1", age: 30, discounts: [] }];
  const intent: SearchIntent = {
    version: 1,
    origin: place,
    destination: place,
    departureDate: "2099-01-01",
    returnDate: null,
    passengers,
    bags: { cabin: 0, checked: 0, bicycles: 0 },
    modes: ["flight"],
    preferences: {
      sort: "cheapest",
      maxTransfers: null,
      accessible: null,
      cabin: null,
    },
    naturalLanguage: null,
  };
  const offer = OfferSchema.parse({
    id: "test:offer",
    provider: "duffel",
    providerOfferId: "test:opaque",
    seller: { id: "test", name: "TEST FIXTURE", merchantOfRecord: null },
    itinerary: {
      id: "test:itinerary",
      legs: [
        {
          id: "test:leg",
          mode: "flight",
          origin: place,
          destination: place,
          departureUtc: "2099-01-01T08:00:00Z",
          arrivalUtc: "2099-01-01T09:00:00Z",
          operator: null,
          providerIds: [],
          timetableStatus: "scheduled",
          seatMapAvailable: null,
          crowding: "unknown",
        },
      ],
      transfers: [],
      completeness: "complete",
      compatibility: "verified",
      missingConnections: [],
    },
    price: {
      kind: "test_offer",
      total: { amount: 100, currency: "EUR" },
      completeness: "complete",
      missingComponents: [],
      breakdown: [],
      observedAt: new Date().toISOString(),
    },
    availability: "available",
    environment: "test",
    freshness: {
      fetchedAt: new Date().toISOString(),
      expiresAt: "2099-01-01T07:00:00Z",
      state: "fresh",
    },
    conditions: {
      summary: null,
      termsUrl: null,
      aftersales: {
        refund: "unknown",
        exchange: "unknown",
        cancellation: "unknown",
      },
    },
    includedServices: [],
    reservationState: "not_reserved",
  });
  const quote: RevalidationResponse = {
    quoteId: "test:quote",
    status: "valid",
    offers: [offer],
    expiresAt: "2099-01-01T07:00:00Z",
    requiresAcceptance: false,
  };
  const request: CreateOrderRequest = {
    quoteId: quote.quoteId,
    idempotencyKey: "test-key",
    passengers,
    email: "unit@example.invalid",
  };
  return { quote, intent, request, offer };
}
test("only complete current supplier quotes can become drafts", () => {
  const { quote, intent, request, offer } = fixture();
  assert.equal(validateOrderQuote(quote, intent, request).id, offer.id);
  offer.price = { kind: "unknown" };
  assert.throws(() => validateOrderQuote(quote, intent, request));
});
test("changed quotes require explicit acceptance and passengers must match", () => {
  const { quote, intent, request } = fixture();
  quote.requiresAcceptance = true;
  quote.status = "changed";
  assert.throws(() => validateOrderQuote(quote, intent, request));
  request.acceptChanges = true;
  assert.doesNotThrow(() => validateOrderQuote(quote, intent, request));
  request.passengers = [{ id: "p1", age: 31, discounts: [] }];
  assert.throws(() => validateOrderQuote(quote, intent, request));
});
test("expired, multi-offer and unverified transfer quotes cannot become orders", () => {
  const { quote, intent, request, offer } = fixture();
  quote.expiresAt = "2000-01-01T00:00:00Z";
  assert.throws(() => validateOrderQuote(quote, intent, request));
  quote.expiresAt = "2099-01-01T00:00:00Z";
  quote.offers.push(offer);
  assert.throws(() => validateOrderQuote(quote, intent, request));
  quote.offers.pop();
  offer.itinerary.compatibility = "unverified";
  assert.throws(() => validateOrderQuote(quote, intent, request));
});
