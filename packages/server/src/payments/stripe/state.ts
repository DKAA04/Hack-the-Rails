import type Stripe from "stripe";
import { ServiceError } from "../../errors";
import type { PaymentState } from "@wayward/contracts";
export function paymentStateFromIntent(
  status: Stripe.PaymentIntent.Status,
): PaymentState {
  switch (status) {
    case "requires_capture":
      return "authorized";
    case "succeeded":
      return "captured";
    case "processing":
      return "processing";
    case "requires_action":
      return "requires_action";
    case "canceled":
      return "cancelled";
    case "requires_payment_method":
      return "failed";
    case "requires_confirmation":
      return "not_started";
    default:
      throw new ServiceError(
        "PROVIDER_UNAVAILABLE",
        "Unknown Stripe payment state; refusing an inferred confirmation.",
        503,
      );
  }
}

// Two verified handlers can retrieve different snapshots before competing for the order lock.
// Never let the older handler regress a terminal capture/refund/cancellation.
export function reconciledPaymentState(
  current: PaymentState,
  observed: PaymentState,
): PaymentState {
  if (
    ["captured", "refunded", "partially_refunded", "cancelled"].includes(
      current,
    )
  )
    return current;
  return observed;
}
