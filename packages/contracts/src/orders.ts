import { z } from "zod";
import {
  BookingPassengerSchema,
  BookingContactSchema,
  OrderWorkflowSchema,
  SupplierDocumentSchema,
} from "./booking";
import { IdSchema, UtcSchema } from "./common";
import { AftersalesSchema, PriceSchema } from "./offers";
import {
  FulfillmentStateSchema,
  PaymentStateSchema,
  SettlementStateSchema,
} from "./payments";
import { PassengerSchema } from "./search";
export const TicketDocumentSchema = z.object({
  id: IdSchema,
  supplierBookingId: IdSchema,
  type: z.enum(["pdf", "barcode", "pkpass", "reference"]),
  downloadUrl: z.url().nullable(),
  reference: z.string().nullable(),
  issuedAt: UtcSchema,
});
export type TicketDocument = z.infer<typeof TicketDocumentSchema>;
export const SupplierBookingSchema = z.object({
  id: IdSchema,
  provider: IdSchema,
  providerBookingId: IdSchema.nullable(),
  offerIds: z.array(IdSchema),
  state: z.enum([
    "pending",
    "reserved",
    "confirmed",
    "failed",
    "cancelled",
    "unknown",
  ]),
  settlement: SettlementStateSchema,
  fulfillment: FulfillmentStateSchema,
  tickets: z.array(TicketDocumentSchema),
  supplierDocuments: z.array(SupplierDocumentSchema).optional(),
  aftersales: AftersalesSchema,
});
export type SupplierBooking = z.infer<typeof SupplierBookingSchema>;
export const OrderSchema = z.object({
  id: IdSchema,
  createdAt: UtcSchema,
  quoteId: IdSchema,
  state: z.enum([
    "draft",
    "pending",
    "confirmed",
    "partial",
    "failed",
    "cancelled",
  ]),
  total: PriceSchema,
  payment: PaymentStateSchema,
  fulfillment: FulfillmentStateSchema,
  bookings: z.array(SupplierBookingSchema),
  environment: z.enum(["test", "live"]).optional(),
  workflow: OrderWorkflowSchema.optional(),
  updatedAt: UtcSchema.optional(),
});
export type Order = z.infer<typeof OrderSchema>;
export const CreateOrderRequestSchema = z.object({
  quoteId: IdSchema,
  idempotencyKey: IdSchema,
  passengers: z.array(PassengerSchema).min(1),
  email: z.email(),
  acceptChanges: z.boolean().optional(),
  travellers: z.array(BookingPassengerSchema).min(1).max(9).optional(),
  contact: BookingContactSchema.optional(),
});
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
