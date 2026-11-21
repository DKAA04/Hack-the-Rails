import { z } from "zod";
import { StripeWebhookResponseSchema, OrderSchema } from "@wayward/contracts";
import { configuration, credentialsPresent } from "../../config";
import { ServiceError } from "../../errors";
import { StoredOrderSchema } from "../../orders";
import { transaction } from "../../db/records";
import { stripeClient } from "./client";
import { verifyStripeEvent, readWebhookBody } from "./verification";
import { paymentStateFromIntent, reconciledPaymentState } from "./state";
const supported = new Set([
  "payment_intent.amount_capturable_updated",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
]);
export async function stripeWebhook(request: Request) {
  if (!credentialsPresent("STRIPE_WEBHOOK_SECRET"))
    throw new ServiceError(
      "NOT_CONFIGURED",
      "Stripe webhook verification is not configured.",
      503,
    );
  const event = verifyStripeEvent(
    await readWebhookBody(request),
    request.headers.get("stripe-signature"),
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
  const config = configuration();
  if (!config.valid)
    throw new ServiceError(
      "NOT_CONFIGURED",
      "Invalid environment configuration.",
      503,
    );
  if (event.livemode !== (config.environment === "live"))
    throw new ServiceError(
      "CONFLICT",
      "Webhook environment does not match application environment.",
      409,
    );
  const response = (duplicate = false, ignored = false) =>
    StripeWebhookResponseSchema.parse({
      version: 1,
      received: true,
      duplicate,
      ignored,
    });
  if (!supported.has(event.type)) return response(false, true);
  const object = z
    .object({
      id: z.string(),
      metadata: z.record(z.string(), z.string()).nullish(),
    })
    .parse(event.data.object);
  const orderId = object.metadata?.waywardOrderId;
  if (!orderId) return response(false, true);
  // Fetch current Stripe state; never apply an out-of-order snapshot to a customer order.
  const intent = await stripeClient().paymentIntents.retrieve(object.id);
  if (
    intent.livemode !== event.livemode ||
    intent.metadata.waywardOrderId !== orderId
  )
    throw new ServiceError(
      "CONFLICT",
      "Stripe payment does not match the order environment or reference.",
      409,
    );
  return transaction(async (client) => {
    await client.lock(`wayward-stripe-event:${event.id}`);
    const seen = await client.get("webhook", event.id);
    if (seen) return response(true);
    const row = await client.get("order", orderId, true);
    if (!row)
      throw new ServiceError(
        "CONFLICT",
        "Stripe event arrived before its durable order mapping. Retry later.",
        409,
        true,
      );
    const stored = StoredOrderSchema.parse(row);
    if (stored.stripePaymentIntentId !== intent.id)
      throw new ServiceError(
        "CONFLICT",
        "Stripe payment is not bound to this order.",
        409,
      );
    const price = stored.order.total;
    if (
      !("total" in price) ||
      price.completeness !== "complete" ||
      intent.amount !== price.total.amount ||
      intent.currency.toUpperCase() !== price.total.currency
    )
      throw new ServiceError(
        "CONFLICT",
        "Stripe amount/currency differs from the accepted order.",
        409,
      );
    stored.order.payment = reconciledPaymentState(
      stored.order.payment,
      paymentStateFromIntent(intent.status),
    );
    if (
      ["authorized", "captured", "processing"].includes(stored.order.payment) &&
      stored.order.state === "draft"
    )
      stored.order.state = "pending";
    // Payment authorization/capture does not change supplier settlement, fulfillment or tickets.
    stored.order = OrderSchema.parse(stored.order);
    await client.put("order", orderId, stored);
    await client.insert("webhook", event.id, {
      type: event.type,
      orderId,
      processedAt: new Date().toISOString(),
    });
    return response();
  });
}
