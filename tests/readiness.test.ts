import { test } from "node:test";
import { supplierReadyForCapture } from "../packages/server/src/payments/policy";
import assert from "node:assert/strict";
import { StoredOrderSchema } from "../packages/server/src/orders";
import { presentOrder } from "../packages/server/src/orders/presentation";
import { matchesAcceptedSupplier } from "../packages/server/src/booking/workflow";
function fixture() {
  const place = {
    id: "test-place",
    name: "Test",
    kind: "airport",
    countryCode: "FR",
    timeZone: "Europe/Paris",
    providerIds: [{ provider: "duffel", id: "airport" }],
    coordinates: null,
  };
  const leg = {
    id: "leg",
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
  };
  const passengers = [{ id: "p1", age: 30, discounts: [] }];
  const total = {
    kind: "test_offer",
    total: { amount: 100, currency: "EUR" },
    completeness: "complete",
    missingComponents: [],
    breakdown: [],
    observedAt: "2026-11-21T00:00:00Z",
  };
  const aftersales = {
    refund: "unknown",
    exchange: "unknown",
    cancellation: "unknown",
  };
  const offer = {
    id: "offer",
    provider: "duffel",
    providerOfferId: "supplier-offer",
    seller: { id: "duffel", name: "Duffel", merchantOfRecord: null },
    itinerary: {
      id: "itinerary",
      legs: [leg],
      transfers: [],
      completeness: "complete",
      compatibility: "verified",
      missingConnections: [],
    },
    price: total,
    availability: "available",
    environment: "test",
    freshness: {
      fetchedAt: "2026-11-21T00:00:00Z",
      expiresAt: "2099-01-01T00:00:00Z",
      state: "fresh",
    },
    conditions: {
      summary: "Supplier fare rules: {}",
      termsUrl: null,
      aftersales,
    },
    includedServices: [],
    reservationState: "not_reserved",
  };
  return StoredOrderSchema.parse({
    order: {
      id: "order",
      quoteId: "quote",
      createdAt: "2026-11-21T00:00:00Z",
      state: "draft",
      total,
      payment: "not_started",
      fulfillment: "not_started",
      bookings: [
        {
          id: "child",
          provider: "duffel",
          providerBookingId: null,
          offerIds: ["offer"],
          state: "pending",
          settlement: "not_started",
          fulfillment: "not_started",
          tickets: [],
          aftersales,
        },
      ],
    },
    quote: {
      quoteId: "quote",
      status: "valid",
      offers: [offer],
      expiresAt: "2099-01-01T00:00:00Z",
      requiresAcceptance: false,
    },
    intent: {
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
    },
    ownerHash: "unit-test",
    requestHash: "unit-test",
    email: "unit@example.invalid",
  });
}
function configured(run: () => void) {
  const values = {
    WAYWARD_ENV: "development",
    DATABASE_URL: "postgresql://unit.invalid/test",
    STRIPE_SECRET_KEY: "sk_test_unit_placeholder",
    DUFFEL_ACCESS_TOKEN: "duffel_test_unit_placeholder",
    APP_URL: "http://localhost:3001",
  };
  const previous = Object.fromEntries(
    Object.keys(values).map((k) => [k, process.env[k]]),
  );
  Object.assign(process.env, values);
  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
test("per-order readiness requires verified hold data and only the affected provider configuration", () =>
  configured(() => {
    const stored = fixture();
    assert.equal(presentOrder(stored).workflow?.phase, "needs_travellers");
    stored.travellers = [
      {
        passengerId: "p1",
        givenName: "Unit",
        familyName: "Test",
        bornOn: "2069-01-01",
        title: "mr",
        gender: "m",
        identityDocuments: [],
      },
    ];
    stored.contact = {
      email: "unit@example.invalid",
      phoneNumber: "+442080160508",
    };
    assert.equal(presentOrder(stored).workflow?.phase, "ready_to_reserve");
    stored.order.bookings[0]!.state = "reserved";
    stored.order.bookings[0]!.providerBookingId = "supplier-held";
    stored.operation = {
      phase: "reserved",
      supplierSnapshot: "verified-test-snapshot",
      supplierPaymentRequiredBy: "2099-01-01T00:00:00Z",
      supplierPriceGuaranteeExpiresAt: "2099-01-01T00:00:00Z",
    };
    assert.equal(presentOrder(stored).workflow?.checkoutReady, true);
    delete stored.operation.supplierSnapshot;
    assert.equal(presentOrder(stored).workflow?.checkoutReady, false);
    stored.operation.supplierSnapshot = "verified-test-snapshot";
    stored.operation.supplierPriceGuaranteeExpiresAt = "2000-01-01T00:00:00Z";
    assert.equal(presentOrder(stored).workflow?.phase, "expired");
  }));
test("unknown held itinerary cannot be treated as accepted and stale reservation work is surfaced", () =>
  configured(() => {
    const stored = fixture();
    assert.equal(
      matchesAcceptedSupplier(
        {
          id: "supplier-held",
          live_mode: false,
          created_at: "2026-11-21T00:00:00Z",
          total_amount: "1.00",
          total_currency: "EUR",
          payment_status: { awaiting_payment: true },
          documents: [],
        },
        stored,
      ),
      false,
    );
    stored.operation = {
      phase: "reserving",
      reserveStartedAt: "2000-01-01T00:00:00Z",
    };
    assert.equal(presentOrder(stored).workflow?.phase, "manual_review");
    assert.equal(presentOrder(stored).workflow?.nextAction, "contact_support");
  }));

test("cancelled or partially fulfilled supplier bookings cannot authorize capture even when documents remain", () => {
  const stored = fixture();
  const booking = stored.order.bookings[0]!;
  booking.state = "confirmed";
  booking.settlement = "settled";
  booking.fulfillment = "fulfilled";
  assert.equal(supplierReadyForCapture(stored.order), true);
  booking.state = "cancelled";
  assert.equal(supplierReadyForCapture(stored.order), false);
  booking.state = "confirmed";
  booking.fulfillment = "partial";
  assert.equal(supplierReadyForCapture(stored.order), false);
});
