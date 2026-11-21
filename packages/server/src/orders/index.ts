import { z } from "zod";
import {
  CreateOrderRequestSchema,
  OrderSchema,
  RevalidationResponseSchema,
  SearchIntentSchema,
  type CreateOrderRequest,
  type Order,
} from "@wayward/contracts";
import type { CustomerContext } from "../auth";
import { hash } from "../auth";
import { transaction, getRecord } from "../db/records";
import { ServiceError } from "../errors";
import { validateOrderQuote } from "./validation";
export const StoredOrderSchema = z.object({
  order: OrderSchema,
  ownerHash: z.string(),
  requestHash: z.string(),
  intent: SearchIntentSchema,
  quote: RevalidationResponseSchema,
  email: z.email(),
  stripeSessionId: z.string().optional(),
  stripePaymentIntentId: z.string().optional(),
});
export type StoredOrder = z.infer<typeof StoredOrderSchema>;
const QuoteRecord = z.object({
  quote: RevalidationResponseSchema,
  intent: SearchIntentSchema,
  consumedBy: z.string().optional(),
});
export async function createOrder(
  input: CreateOrderRequest,
  context: CustomerContext,
): Promise<Order> {
  const request = CreateOrderRequestSchema.parse(input);
  const id = hash(`${context.ownerHash}:${request.idempotencyKey}`);
  const requestHash = hash(JSON.stringify(request));
  return transaction(async (client) => {
    // Transaction-scoped lock also serializes two retries with the same key before their row exists.
    await client.lock(`wayward-order:${id}`);
    const existing = await client.get("order", id, true);
    if (existing) {
      const stored = StoredOrderSchema.parse(existing);
      if (stored.requestHash !== requestHash)
        throw new ServiceError(
          "CONFLICT",
          "Idempotency key was already used with different order details.",
          409,
        );
      return stored.order;
    }
    const row = await client.get("quote", request.quoteId, true);
    if (!row)
      throw new ServiceError(
        "NOT_FOUND",
        "Quote not found. Revalidate again using this database.",
        404,
      );
    const stored = QuoteRecord.parse(row);
    if (stored.consumedBy)
      throw new ServiceError(
        "CONFLICT",
        "Quote already belongs to an order.",
        409,
      );
    const offer = validateOrderQuote(stored.quote, stored.intent, request);
    const order = OrderSchema.parse({
      id,
      createdAt: new Date().toISOString(),
      quoteId: request.quoteId,
      state: "draft",
      total: offer.price,
      payment: "not_started",
      fulfillment: "not_started",
      bookings: [
        {
          id: `${id}-0`,
          provider: offer.provider,
          providerBookingId: null,
          offerIds: [offer.id],
          state: "pending",
          settlement: "not_started",
          fulfillment: "not_started",
          tickets: [],
          aftersales: offer.conditions.aftersales,
        },
      ],
    });
    const record = StoredOrderSchema.parse({
      order,
      ownerHash: context.ownerHash,
      requestHash,
      intent: stored.intent,
      quote: stored.quote,
      email: request.email,
    });
    await client.insert("order", id, record);
    await client.put("quote", request.quoteId, { ...stored, consumedBy: id });
    return order;
  });
}
export async function authorizedOrder(
  id: string,
  context: CustomerContext,
): Promise<StoredOrder> {
  const raw = await getRecord("order", id);
  if (!raw) throw new ServiceError("NOT_FOUND", "Order not found.", 404);
  const stored = StoredOrderSchema.parse(raw);
  if (stored.ownerHash !== context.ownerHash)
    throw new ServiceError("NOT_FOUND", "Order not found.", 404);
  return stored;
}
export async function getOrder(
  id: string,
  context: CustomerContext,
): Promise<Order> {
  return (await authorizedOrder(id, context)).order;
}
