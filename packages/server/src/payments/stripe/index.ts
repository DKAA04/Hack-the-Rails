import { z } from "zod";
import { StripeWebhookResponseSchema } from "@wayward/contracts";
import { configuration, credentialsPresent } from "../../config";
import { ServiceError } from "../../errors";
import { StoredOrderSchema } from "../../orders";
import { transaction, getRecord } from "../../db/records";
import { stripeClient } from "./client";
import { verifyStripeEvent, readWebhookBody } from "./verification";
import { reconcileWorkflow } from "../workflow";
const supported = new Set([
  "payment_intent.amount_capturable_updated",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "checkout.session.completed",
  "checkout.session.expired",
]);
export async function stripeWebhook(request: Request) {
  if (!credentialsPresent("STRIPE_WEBHOOK_SECRET"))
    throw new ServiceError(
      "NOT_CONFIGURED",
      "STRIPE_WEBHOOK_SECRET is missing.",
      503,
    );
  const event = verifyStripeEvent(
    await readWebhookBody(request),
    request.headers.get("stripe-signature"),
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
  const config = configuration();
  if (!config.valid || config.environment !== "development" || event.livemode)
    throw new ServiceError(
      "CONFLICT",
      "Only development/test transaction webhooks are enabled.",
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
  const raw = await getRecord("order", orderId);
  if (!raw)
    throw new ServiceError(
      "CONFLICT",
      "Event arrived before its durable order mapping; retry later.",
      409,
      true,
    );
  const stored = StoredOrderSchema.parse(raw);
  if (!stored.stripeSessionId)
    throw new ServiceError(
      "CONFLICT",
      "Order has no mapped Stripe Checkout session.",
      409,
      true,
    );
  const session = await stripeClient().checkout.sessions.retrieve(
    stored.stripeSessionId,
  );
  const intentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (
    session.livemode ||
    session.metadata?.waywardOrderId !== orderId ||
    (event.type.startsWith("checkout.session.")
      ? object.id !== stored.stripeSessionId
      : object.id !== intentId)
  )
    throw new ServiceError(
      "CONFLICT",
      "Event is not bound to the order Checkout/payment.",
      409,
    );
  const claim = await transaction(async (records) => {
    await records.lock(`wayward-stripe-event:${event.id}`);
    const previous = (await records.get("webhook", event.id)) as {
      state?: string;
      startedAt?: string;
    } | null;
    if (previous?.state === "complete") return false;
    if (
      previous?.state === "processing" &&
      Date.parse(previous.startedAt ?? "") > Date.now() - 180000
    )
      throw new ServiceError(
        "PROVIDER_UNAVAILABLE",
        "This event is already processing. Retry later.",
        503,
        true,
      );
    await records.put("webhook", event.id, {
      state: "processing",
      type: event.type,
      orderId,
      startedAt: new Date().toISOString(),
    });
    return true;
  });
  if (!claim) return response(true);
  try {
    await reconcileWorkflow(orderId);
    await transaction(async (records) => {
      await records.put("webhook", event.id, {
        state: "complete",
        type: event.type,
        orderId,
        processedAt: new Date().toISOString(),
      });
    });
    return response();
  } catch (error) {
    await transaction(async (records) => {
      await records.put("webhook", event.id, {
        state: "failed",
        type: event.type,
        orderId,
        failedAt: new Date().toISOString(),
      });
    });
    throw error;
  }
}
