import {
  CheckoutRequestSchema,
  CheckoutResponseSchema,
  type CheckoutRequest,
  type CheckoutResponse,
} from "@wayward/contracts";
import type { CustomerContext } from "../auth";
import { authorizedOrder } from "../orders";
import { mutateOrder } from "../orders/store";
import { presentOrder } from "../orders/presentation";
import { ServiceError } from "../errors";
import { stripeClient } from "./stripe/client";
import { checkoutParameters } from "./stripe/session";
import type Stripe from "stripe";
export async function checkout(
  input: CheckoutRequest,
  context: CustomerContext,
): Promise<CheckoutResponse> {
  const request = CheckoutRequestSchema.parse(input);
  await authorizedOrder(request.orderId, context);
  const claim = await mutateOrder(request.orderId, async (stored, records) => {
    if (stored.stripeSessionId && stored.stripeCheckoutUrl) {
      if (
        !stored.stripeSessionExpiresAt ||
        Date.parse(stored.stripeSessionExpiresAt) <= Date.now()
      )
        throw new ServiceError(
          "QUOTE_EXPIRED",
          "Checkout expired; reconcile the order before taking further action.",
          409,
        );
      return {
        cached: CheckoutResponseSchema.parse({
          sessionId: stored.stripeSessionId,
          redirectUrl: stored.stripeCheckoutUrl,
        }),
        params: null,
      };
    }
    const order = presentOrder(stored);
    if (!order.workflow?.checkoutReady)
      throw new ServiceError(
        "CONFLICT",
        `Order is not ready for checkout: ${order.workflow?.reasons.join(" ") || order.workflow?.nextAction || "reserve a supported supplier offer first"}`,
        409,
      );
    const prior = (await records.get("checkout", stored.order.id)) as {
      params?: Stripe.Checkout.SessionCreateParams;
    } | null;
    if (prior?.params) return { cached: null, params: prior.params };
    const expires =
      Math.floor(
        Math.min(
          Date.parse(order.workflow.paymentRequiredBy!),
          Date.parse(order.workflow.priceGuaranteeExpiresAt!),
          Date.now() + 23 * 3600000,
        ) / 1000,
      ) - 60;
    const params = { ...checkoutParameters(stored), expires_at: expires };
    await records.put("checkout", stored.order.id, {
      params,
      state: "creating",
      createdAt: new Date().toISOString(),
    });
    return { cached: null, params };
  });
  if (claim.cached) return claim.cached;
  const stripe = stripeClient();
  const balance = await stripe.balance.retrieve();
  if (balance.livemode)
    throw new ServiceError(
      "CONFLICT",
      "Checkout requires verified Stripe test-mode access.",
      409,
    );
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(claim.params!, {
      idempotencyKey: `wayward-checkout-${request.orderId}`,
    });
  } catch {
    throw new ServiceError(
      "PROVIDER_UNAVAILABLE",
      "Stripe Checkout creation failed. Retrying this same order uses the same provider idempotency key.",
      503,
      true,
    );
  }
  if (session.livemode || !session.url)
    throw new ServiceError(
      "CONFLICT",
      "Unexpected Stripe checkout environment or missing hosted URL.",
      409,
    );
  return mutateOrder(request.orderId, async (stored, records) => {
    stored.stripeSessionId = session.id;
    stored.stripeCheckoutUrl = session.url!;
    stored.stripeSessionExpiresAt = new Date(
      session.expires_at * 1000,
    ).toISOString();
    if (typeof session.payment_intent === "string")
      stored.stripePaymentIntentId = session.payment_intent;
    stored.operation.phase = "awaiting_payment";
    stored.order.payment = "requires_action";
    await records.put("checkout", stored.order.id, {
      sessionId: session.id,
      state: "created",
    });
    return CheckoutResponseSchema.parse({
      sessionId: session.id,
      redirectUrl: session.url,
    });
  });
}
