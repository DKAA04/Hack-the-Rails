import { z } from "zod";
import { IdSchema, MoneySchema } from "./common";
export const PaymentStateSchema = z.enum([
  "not_started",
  "requires_action",
  "processing",
  "authorized",
  "captured",
  "failed",
  "cancelled",
  "partially_refunded",
  "refunded",
]);
export type PaymentState = z.infer<typeof PaymentStateSchema>;
export const FulfillmentStateSchema = z.enum([
  "not_started",
  "pending",
  "partial",
  "fulfilled",
  "failed",
]);
export type FulfillmentState = z.infer<typeof FulfillmentStateSchema>;
export const SettlementStateSchema = z.enum([
  "not_started",
  "pending",
  "settled",
  "failed",
  "refunded",
]);
export type SettlementState = z.infer<typeof SettlementStateSchema>;
export const PaymentSchema = z.object({
  id: IdSchema,
  orderId: IdSchema,
  state: PaymentStateSchema,
  money: MoneySchema,
  stripeSessionId: IdSchema.nullable(),
});
export type Payment = z.infer<typeof PaymentSchema>;
export const CheckoutRequestSchema = z.object({
  orderId: IdSchema,
  idempotencyKey: IdSchema,
});
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;
export const CheckoutResponseSchema = z.object({
  sessionId: IdSchema,
  redirectUrl: z.url(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;
