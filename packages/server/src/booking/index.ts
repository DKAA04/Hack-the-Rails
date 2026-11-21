import type { SupplierBooking } from "@wayward/contracts";
import { unfinished } from "../errors";
// Supplier settlement is independent of customer authorization/capture and ticket fulfillment.
export interface BookingService {
  book(quoteId: string, idempotencyKey: string): Promise<SupplierBooking>;
}
export async function settleSupplier(_bookingId: string): Promise<never> {
  return unfinished("Supplier settlement");
}
export async function fulfillTickets(_bookingId: string): Promise<never> {
  return unfinished("Supplier ticket fulfillment");
}
