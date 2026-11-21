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

export const SAMPLE_ORDERS: Record<"pending" | "confirmed" | "failed" | "cancelled", Order> = {
  pending: OrderSchema.parse({
    ...base,
    id: "sample-pending",
    state: "pending",
    payment: "authorized",
    fulfillment: "pending",
    bookings: [
      { id: "b1", provider: "duffel", providerBookingId: null, offerIds: ["o1"], state: "pending", settlement: "not_started", fulfillment: "pending", tickets: [], aftersales },
    ],
  }),
  confirmed: OrderSchema.parse({
    ...base,
    id: "sample-confirmed",
    state: "confirmed",
    payment: "captured",
    fulfillment: "fulfilled",
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
        aftersales,
      },
    ],
  }),
  failed: OrderSchema.parse({
    ...base,
    id: "sample-failed",
    state: "failed",
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
