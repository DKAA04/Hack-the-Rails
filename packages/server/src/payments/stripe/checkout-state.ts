import type { StoredOrder } from "../../orders";
import { ServiceError } from "../../errors";

// Called under the order lock: a delayed duplicate Checkout response must not
// overwrite a newer webhook/reconciliation result.
export function recordCheckoutSession(
  stored: StoredOrder,
  session: {
    id: string;
    url: string;
    expiresAt: string;
    paymentIntentId?: string;
  },
) {
  const alreadyMapped = Boolean(stored.stripeSessionId);
  if (alreadyMapped && stored.stripeSessionId !== session.id)
    throw new ServiceError(
      "CONFLICT",
      "Another Checkout session already owns this order.",
      409,
    );
  stored.stripeSessionId = session.id;
  stored.stripeCheckoutUrl = session.url;
  stored.stripeSessionExpiresAt = session.expiresAt;
  if (session.paymentIntentId) {
    if (
      stored.stripePaymentIntentId &&
      stored.stripePaymentIntentId !== session.paymentIntentId
    )
      throw new ServiceError(
        "CONFLICT",
        "Another customer payment already owns this order.",
        409,
      );
    stored.stripePaymentIntentId = session.paymentIntentId;
  }
  if (
    !alreadyMapped &&
    stored.order.payment === "not_started" &&
    !["confirmed", "failed"].includes(stored.order.state) &&
    ![
      "complete",
      "failed",
      "expired",
      "manual_review",
      "needs_acceptance",
    ].includes(stored.operation.phase ?? "")
  ) {
    stored.operation.phase = "awaiting_payment";
    stored.order.payment = "requires_action";
  }
}
