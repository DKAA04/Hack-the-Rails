import type { Order } from "@wayward/contracts";
// Issued documents can remain on a cancelled booking. Only active, confirmed,
// settled and fully fulfilled supplier children permit customer capture.
export function supplierReadyForCapture(order: Order): boolean {
  return (
    order.bookings.length > 0 &&
    order.bookings.every(
      (booking) =>
        booking.state === "confirmed" &&
        booking.settlement === "settled" &&
        booking.fulfillment === "fulfilled",
    )
  );
}
