// SAMPLE DATA ONLY. Not a real order, booking, payment or ticket.
// Used solely to preview how order states render; every screen that shows it
// displays a "Sample data" label. Validated against the v1 contract so the
// preview can't drift from what the backend will send.
import { OrderSchema, type Order } from "@wayward/contracts";
import { toOrderView, type OrderView } from "../../checkout/mappers/order";

const base: Omit<Order, "state" | "payment" | "fulfillment" | "bookings"> = {
  id: "sample-order",
  createdAt: "2026-11-21T09:30:00Z",
  quoteId: "sample-quote",
  total: {
    kind: "test_offer",
    total: { amount: 14890, currency: "EUR" },
    completeness: "complete",
    missingComponents: [],
    breakdown: [
      { label: "Fare", money: { amount: 12400, currency: "EUR" }, category: "fare" },
      { label: "Taxes", money: { amount: 1990, currency: "EUR" }, category: "tax" },
      { label: "Seller fee", money: { amount: 500, currency: "EUR" }, category: "service" },
    ],
    observedAt: "2026-11-21T09:29:00Z",
  },
};

const aftersales = { refund: "unknown", exchange: "supported", cancellation: "unknown" } as const;

const wf = (
  phase: NonNullable<Order["workflow"]>["phase"],
  nextAction: NonNullable<Order["workflow"]>["nextAction"],
  extra: Partial<NonNullable<Order["workflow"]>> = {},
): NonNullable<Order["workflow"]> => ({
  phase,
  nextAction,
  checkoutReady: false,
  reasons: [],
  retryAfterMs: null,
  paymentRequiredBy: null,
  priceGuaranteeExpiresAt: null,
  ...extra,
});

export const SAMPLE_ORDERS: Record<"pending" | "reserved" | "confirmed" | "review" | "failed" | "cancelled", Order> = {
  pending: OrderSchema.parse({
    ...base,
    id: "sample-pending",
    state: "pending",
    environment: "test",
    payment: "authorized",
    fulfillment: "pending",
    workflow: wf("fulfilling", "poll", { retryAfterMs: 5000 }),
    bookings: [
      { id: "b1", provider: "duffel", providerBookingId: null, offerIds: ["o1"], state: "pending", settlement: "not_started", fulfillment: "pending", tickets: [], aftersales },
    ],
  }),
  confirmed: OrderSchema.parse({
    ...base,
    id: "sample-confirmed",
    state: "confirmed",
    environment: "test",
    payment: "captured",
    fulfillment: "fulfilled",
    workflow: wf("complete", "none"),
    bookings: [
      {
        id: "b1",
        provider: "duffel",
        providerBookingId: "SAMPLE-PNR",
        offerIds: ["o1"],
        state: "confirmed",
        settlement: "settled",
        fulfillment: "fulfilled",
        tickets: [
          { id: "t1", supplierBookingId: "b1", type: "reference", downloadUrl: null, reference: "SAMPLE1", issuedAt: "2026-11-21T09:32:00Z" },
          { id: "t2", supplierBookingId: "b1", type: "pdf", downloadUrl: "https://example.com/sample-ticket.pdf", reference: null, issuedAt: "2026-11-21T09:32:00Z" },
        ],
        supplierDocuments: [
          { id: "d1", documentType: "electronic_ticket", reference: "SAMPLE-0012345678", downloadUrl: null, issuedAt: null, observedAt: "2026-11-21T09:33:00Z", passengerProviderIds: ["pas_1"] },
        ],
        aftersales,
      },
    ],
  }),
  reserved: OrderSchema.parse({
    ...base,
    id: "sample-reserved",
    state: "pending",
    environment: "test",
    payment: "not_started",
    fulfillment: "not_started",
    workflow: wf("ready_for_checkout", "checkout", {
      checkoutReady: true,
      paymentRequiredBy: "2026-11-22T09:30:00Z",
      priceGuaranteeExpiresAt: "2026-11-21T21:30:00Z",
    }),
    bookings: [
      { id: "b1", provider: "duffel", providerBookingId: "SAMPLE-HOLD", offerIds: ["o1"], state: "reserved", settlement: "not_started", fulfillment: "not_started", tickets: [], aftersales },
    ],
  }),
  review: OrderSchema.parse({
    ...base,
    id: "sample-review",
    state: "pending",
    environment: "test",
    payment: "authorized",
    fulfillment: "not_started",
    workflow: wf("manual_review", "contact_support", { reasons: ["The seller's response didn't match the reserved price."] }),
    bookings: [
      { id: "b1", provider: "duffel", providerBookingId: null, offerIds: ["o1"], state: "unknown", settlement: "not_started", fulfillment: "not_started", tickets: [], aftersales },
    ],
  }),
  failed: OrderSchema.parse({
    ...base,
    id: "sample-failed",
    state: "failed",
    environment: "test",
    workflow: wf("failed", "none", { reasons: ["The seller rejected the reservation."] }),
    payment: "refunded",
    fulfillment: "failed",
    bookings: [
      { id: "b1", provider: "duffel", providerBookingId: null, offerIds: ["o1"], state: "failed", settlement: "refunded", fulfillment: "failed", tickets: [], aftersales },
    ],
  }),
  cancelled: OrderSchema.parse({
    ...base,
    id: "sample-cancelled",
    state: "cancelled",
    environment: "test",
    workflow: wf("expired", "none"),
    payment: "refunded",
    fulfillment: "not_started",
    bookings: [
      { id: "b1", provider: "duffel", providerBookingId: "SAMPLE-PNR", offerIds: ["o1"], state: "cancelled", settlement: "refunded", fulfillment: "not_started", tickets: [], aftersales },
    ],
  }),
};

export type SampleOrderKey = keyof typeof SAMPLE_ORDERS;
export function sampleOrderView(key: SampleOrderKey): OrderView {
  return toOrderView(SAMPLE_ORDERS[key]);
}
