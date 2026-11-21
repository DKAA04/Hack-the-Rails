import { loadEnvFile } from "node:process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "../packages/server/node_modules/zod/index.js";
import { duffelJson } from "../packages/server/src/providers/duffel/client";
import {
  DuffelOfferSchema,
  normalizeFlight,
} from "../packages/server/src/providers/duffel/normalize";
import { normalizeDuffelPlace } from "../packages/server/src/places";
import {
  reserveFlight,
  priceHeldOrder,
  settleHeldOrder,
  retrieveSupplierOrder,
  supplierPayments,
  supplierBooking,
  assertTestTransaction,
} from "../packages/server/src/providers/duffel/transactions";
import type { SearchIntent } from "../packages/contracts/src/index";
loadEnvFile("apps/web/.env.local");
const path = ".local/supplier-hold-success-test.json";
mkdirSync(".local", { recursive: true });
const persist = (data: unknown) =>
  writeFileSync(path, JSON.stringify(data), { mode: 0o600 });
async function main() {
  if (!process.argv.includes("--execute-test-transaction"))
    throw new Error("Explicit --execute-test-transaction flag required");
  if (
    existsSync(path) &&
    JSON.parse(readFileSync(path, "utf8")).reservationAttempted !== false
  ) {
    const checkpoint = JSON.parse(readFileSync(path, "utf8"));
    if (!checkpoint.supplierOrderId) {
      console.log(
        "Unresolved supplier checkpoint. Reconcile; do not repeat creation.",
      );
      return;
    }
    const held = await retrieveSupplierOrder(checkpoint.supplierOrderId);
    assertTestTransaction(held.live_mode);
    if (!checkpoint.settlementAttempted) {
      const priced = await priceHeldOrder(held.id);
      persist({ ...checkpoint, settlementAttempted: true });
      const payment = await settleHeldOrder(priced);
      console.log(
        JSON.stringify({
          stage: "supplier_settlement",
          status: payment.status,
          environment: payment.live_mode ? "live" : "test",
        }),
      );
    }
    const [fulfilled, payments] = await Promise.all([
      retrieveSupplierOrder(held.id),
      supplierPayments(held.id),
    ]);
    const booking = supplierBooking(
      fulfilled,
      {
        id: "test-child",
        provider: "duffel",
        providerBookingId: held.id,
        offerIds: [checkpoint.offerId],
        state: "reserved",
        settlement: "not_started",
        fulfillment: "not_started",
        tickets: [],
        aftersales: {
          refund: "unknown",
          exchange: "unknown",
          cancellation: "unknown",
        },
      },
      payments,
    );
    persist({
      ...checkpoint,
      settlementAttempted: true,
      settlement: booking.settlement,
      fulfillment: booking.fulfillment,
      documents: booking.supplierDocuments,
    });
    console.log(
      JSON.stringify({
        stage: "supplier_fulfillment",
        environment: "test",
        settlement: booking.settlement,
        fulfillment: booking.fulfillment,
        documents: booking.supplierDocuments?.map((d) => ({
          type: d.documentType,
          referencePresent: !!d.reference,
          issuedAtKnown: d.issuedAt !== null,
          downloadUrlPresent: !!d.downloadUrl,
        })),
      }),
    );
    if (booking.settlement !== "settled" || booking.fulfillment !== "fulfilled")
      throw new Error(
        "Existing test transaction needs reconciliation, never automatic resubmission.",
      );
    return;
  }
  const departure = new Date(Date.now() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const response = z
    .object({
      data: z.object({ live_mode: z.boolean(), offers: z.array(z.unknown()) }),
    })
    .parse(
      await duffelJson(
        "/air/offer_requests?return_offers=true&supplier_timeout=6000",
        {
          data: {
            slices: [
              { origin: "JFK", destination: "EWR", departure_date: departure },
            ],
            passengers: [{ age: 30 }],
          },
        },
      ),
    );
  assertTestTransaction(response.data.live_mode);
  const candidates = response.data.offers.map((o) =>
    DuffelOfferSchema.parse(o),
  );
  const raw = candidates.find(
    (o) =>
      o.owner.name === "Duffel Airways" &&
      o.payment_requirements?.requires_instant_payment === false,
  );
  if (!raw)
    throw new Error("No documented Duffel Airways test hold offer returned");
  const intent: SearchIntent = {
    version: 1,
    origin: normalizeDuffelPlace(raw.slices[0]!.segments[0]!.origin)!,
    destination: normalizeDuffelPlace(
      raw.slices[0]!.segments.at(-1)!.destination,
    )!,
    departureDate: departure,
    returnDate: null,
    passengers: [{ id: "p1", age: 30, discounts: [] }],
    bags: { cabin: 0, checked: 0, bicycles: 0 },
    modes: ["flight"],
    preferences: {
      sort: "cheapest",
      maxTransfers: 0,
      accessible: null,
      cabin: null,
    },
    naturalLanguage: null,
  };
  const offer = normalizeFlight(raw, intent);
  const reference = `wayward-test-${randomUUID()}`;
  persist({
    reference,
    offerId: offer.providerOfferId,
    reservationAttempted: true,
    environment: "test",
  });
  const held = await reserveFlight(
    offer,
    intent,
    [
      {
        passengerId: "p1",
        givenName: "Wayward",
        familyName: "TestTraveller",
        bornOn: `${Number(departure.slice(0, 4)) - 30}-01-01`,
        title: "mr",
        gender: "m",
        identityDocuments: [],
      },
    ],
    { email: "sandbox@example.com", phoneNumber: "+442080160508" },
    reference,
  );
  persist({
    reference,
    offerId: offer.providerOfferId,
    supplierOrderId: held.id,
    environment: "test",
    reservationAttempted: true,
  });
  console.log(
    JSON.stringify({
      stage: "supplier_hold",
      verified: !held.live_mode && held.payment_status.awaiting_payment,
      environment: "test",
      documentCount: held.documents.length,
    }),
  );
  const priced = await priceHeldOrder(held.id);
  assertTestTransaction(priced.live_mode);
  if (
    priced.total_amount !== held.total_amount ||
    priced.total_currency !== held.total_currency
  )
    throw new Error(
      "Held price changed. Do not settle without renewed acceptance.",
    );
  persist({
    reference,
    offerId: offer.providerOfferId,
    supplierOrderId: held.id,
    environment: "test",
    reservationAttempted: true,
    settlementAttempted: true,
  });
  const paid = await settleHeldOrder(priced);
  console.log(
    JSON.stringify({
      stage: "supplier_settlement",
      status: paid.status,
      environment: paid.live_mode ? "live" : "test",
    }),
  );
  const [fulfilled, payments] = await Promise.all([
    retrieveSupplierOrder(held.id),
    supplierPayments(held.id),
  ]);
  const booking = supplierBooking(
    fulfilled,
    {
      id: "test-child",
      provider: "duffel",
      providerBookingId: held.id,
      offerIds: [offer.id],
      state: "reserved",
      settlement: "not_started",
      fulfillment: "not_started",
      tickets: [],
      aftersales: {
        refund: "unknown",
        exchange: "unknown",
        cancellation: "unknown",
      },
    },
    payments,
  );
  persist({
    reference,
    offerId: offer.providerOfferId,
    supplierOrderId: held.id,
    environment: "test",
    reservationAttempted: true,
    settlementAttempted: true,
    settlement: booking.settlement,
    fulfillment: booking.fulfillment,
    documents: booking.supplierDocuments,
  });
  console.log(
    JSON.stringify({
      stage: "supplier_fulfillment",
      environment: "test",
      settlement: booking.settlement,
      fulfillment: booking.fulfillment,
      documents: booking.supplierDocuments?.map((d) => ({
        type: d.documentType,
        referencePresent: Boolean(d.reference),
        issuedAtKnown: d.issuedAt !== null,
        downloadUrlPresent: !!d.downloadUrl,
      })),
    }),
  );
  if (booking.settlement !== "settled" || booking.fulfillment !== "fulfilled")
    throw new Error(
      "Supplier test is not fully fulfilled; reconcile without resubmission.",
    );
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      stage: "supplier_test",
      status: "failed",
      issues:
        error instanceof z.ZodError
          ? error.issues.map((i) => ({ code: i.code, path: i.path }))
          : undefined,
      code: error.code ?? null,
      uncertain: error.uncertain ?? false,
      message:
        error instanceof z.ZodError
          ? "Supplier response did not match the expected schema"
          : error instanceof Error
            ? error.message
            : "Unknown error",
    }),
  );
  process.exitCode = 1;
});
