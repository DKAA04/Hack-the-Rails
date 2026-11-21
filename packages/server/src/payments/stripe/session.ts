import type Stripe from "stripe";
import type { StoredOrder } from "../../orders";
import { ServiceError } from "../../errors";
// Pure builder; no Stripe call or monetary movement occurs here.
export function checkoutParameters(
  stored: StoredOrder,
): Stripe.Checkout.SessionCreateParams {
  const total = stored.order.total;
  if (!("total" in total) || total.completeness !== "complete")
    throw new ServiceError(
      "CONFLICT",
      "Checkout requires a complete supplier total.",
      409,
    );
  const app = process.env.APP_URL;
  if (!app)
    throw new ServiceError(
      "NOT_CONFIGURED",
      "APP_URL is required for trusted checkout return URLs.",
      503,
    );
  const url = new URL(app);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new ServiceError("NOT_CONFIGURED", "APP_URL is invalid.", 503);
  return {
    mode: "payment",
    allowed_payment_method_types: ["card"],
    client_reference_id: stored.order.id,
    customer_email: stored.email,
    metadata: { waywardOrderId: stored.order.id },
    payment_intent_data: {
      capture_method: "manual",
      metadata: { waywardOrderId: stored.order.id },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: total.total.currency.toLowerCase(),
          unit_amount: total.total.amount,
          product_data: {
            name: "Wayward journey ? authorization pending supplier booking",
          },
        },
      },
    ],
    success_url: new URL(
      `/?order=${encodeURIComponent(stored.order.id)}&checkout=returned`,
      url,
    ).toString(),
    cancel_url: new URL(
      `/?order=${encodeURIComponent(stored.order.id)}&checkout=cancelled`,
      url,
    ).toString(),
  };
}
