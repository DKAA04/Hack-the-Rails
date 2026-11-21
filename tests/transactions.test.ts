import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDuffelPlace } from "../packages/server/src/places";
import {
  supplierBooking,
  SupplierMutationError,
  assertTestTransaction,
} from "../packages/server/src/providers/duffel/transactions";
import {
  BookingPassengerSchema,
  BookingContactSchema,
} from "../packages/contracts/src/index";
import { supplierFareRules } from "../packages/server/src/providers/duffel/normalize";
const base = {
  id: "child-test",
  provider: "duffel",
  providerBookingId: null,
  offerIds: ["test-offer"],
  state: "pending" as const,
  settlement: "not_started" as const,
  fulfillment: "not_started" as const,
  tickets: [],
  aftersales: {
    refund: "unknown" as const,
    exchange: "unknown" as const,
    cancellation: "unknown" as const,
  },
};
function raw(
  documents: {
    type: string;
    unique_identifier: string;
    passenger_ids: string[];
  }[],
) {
  return {
    id: "test-supplier-order",
    live_mode: false,
    created_at: "2026-11-21T12:00:00Z",
    total_amount: "12.34",
    total_currency: "EUR",
    payment_status: { awaiting_payment: false },
    passengers: [{ id: "supplier-passenger" }],
    documents,
  };
}
const paid = [
  {
    id: "test-payment",
    order_id: "test-supplier-order",
    status: "succeeded" as const,
    live_mode: false,
    amount: "12.34",
    currency: "EUR",
  },
];
test("real supplier references preserve unknown timestamps/URLs and do not fabricate ticket PDFs", () => {
  const result = supplierBooking(
    raw([
      {
        type: "electronic_ticket",
        unique_identifier: "TEST-REFERENCE",
        passenger_ids: ["supplier-passenger"],
      },
    ]),
    base,
    paid,
  );
  assert.equal(result.settlement, "settled");
  assert.equal(result.fulfillment, "fulfilled");
  assert.equal(result.tickets.length, 0);
  assert.equal(result.supplierDocuments?.[0]?.reference, "TEST-REFERENCE");
  assert.equal(result.supplierDocuments?.[0]?.issuedAt, null);
  assert.equal(result.supplierDocuments?.[0]?.downloadUrl, null);
});
test("invoices and incomplete passenger coverage cannot imply full ticket issuance", () => {
  const invoice = supplierBooking(
    raw([
      {
        type: "invoice",
        unique_identifier: "TEST-INVOICE",
        passenger_ids: ["supplier-passenger"],
      },
    ]),
    base,
    paid,
  );
  assert.notEqual(invoice.fulfillment, "fulfilled");
  const partial = supplierBooking(
    {
      ...raw([
        {
          type: "electronic_ticket",
          unique_identifier: "TEST-REFERENCE",
          passenger_ids: ["supplier-passenger"],
        },
      ]),
      passengers: [{ id: "supplier-passenger" }, { id: "other-passenger" }],
    },
    base,
    paid,
  );
  assert.equal(partial.fulfillment, "partial");
});
test("unmatched supplier payments cannot imply settlement", () => {
  assert.equal(
    supplierBooking(raw([]), base, [{ ...paid[0]!, amount: "99.00" }])
      .settlement,
    "not_started",
  );
});
test("identity/contact validation is additive and fare penalties remain visible", () => {
  assert.equal(
    BookingContactSchema.safeParse({
      email: "test@example.com",
      phoneNumber: "123",
    }).success,
    false,
  );
  assert.equal(
    BookingPassengerSchema.safeParse({
      passengerId: "p1",
      givenName: "Test",
      familyName: "Traveller",
      bornOn: "1996-01-01",
      title: "mr",
      gender: "m",
    }).success,
    true,
  );
  assert.match(
    supplierFareRules({
      refund_before_departure: {
        allowed: true,
        penalty_amount: "25.00",
        penalty_currency: "EUR",
      },
    }),
    /25.00/,
  );
});
test("nullable airport lists are normalized and uncertain mutations are never automatically retryable", () => {
  assert.ok(
    normalizeDuffelPlace({
      id: "test-airport",
      name: "Test airport",
      type: "airport",
      iata_code: "LHR",
      time_zone: "Europe/London",
      airports: null,
    }),
  );
  assert.equal(
    new SupplierMutationError("Unknown outcome", true).retryable,
    false,
  );
  assert.throws(() => assertTestTransaction(true));
});
