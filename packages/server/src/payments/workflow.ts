import { type Order } from "@wayward/contracts";
import type { CustomerContext } from "../auth";
import { authorizedOrder, type StoredOrder } from "../orders";
import { mutateOrder } from "../orders/store";
import { presentOrder } from "../orders/presentation";
import { reconcileSupplier, supplierSnapshot } from "../booking/workflow";
import {
  priceHeldOrder,
  settleHeldOrder,
  retrieveSupplierOrder,
  supplierPayments,
  SupplierMutationError,
} from "../providers/duffel/transactions";
import { stripeClient } from "./stripe/client";
import { paymentStateFromIntent, reconciledPaymentState } from "./stripe/state";
import { ServiceError } from "../errors";
import type Stripe from "stripe";
async function customerPayment(
  stored: StoredOrder,
): Promise<Stripe.PaymentIntent | null> {
  if (!stored.stripeSessionId) return null;
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(
    stored.stripeSessionId,
    { expand: ["payment_intent"] },
  );
  const price = stored.order.total;
  if (
    session.livemode ||
    session.client_reference_id !== stored.order.id ||
    session.metadata?.waywardOrderId !== stored.order.id ||
    !("total" in price) ||
    session.amount_total !== price.total.amount ||
    session.currency?.toUpperCase() !== price.total.currency
  )
    throw new ServiceError(
      "CONFLICT",
      "Stripe Checkout does not match the accepted test order.",
      409,
    );
  if (session.status === "expired")
    await mutateOrder(stored.order.id, (s) => {
      if (!["captured", "authorized"].includes(s.order.payment)) {
        s.operation.phase = "expired";
        s.order.state = "failed";
      }
    });
  if (!session.payment_intent) return null;
  const intent =
    typeof session.payment_intent === "string"
      ? await stripe.paymentIntents.retrieve(session.payment_intent)
      : session.payment_intent;
  if (
    intent.livemode ||
    intent.metadata.waywardOrderId !== stored.order.id ||
    intent.amount !== price.total.amount ||
    intent.currency.toUpperCase() !== price.total.currency ||
    intent.capture_method !== "manual"
  )
    throw new ServiceError(
      "CONFLICT",
      "Customer payment is not a matching manual-capture test authorization.",
      409,
    );
  if (
    stored.stripePaymentIntentId &&
    stored.stripePaymentIntentId !== intent.id
  )
    throw new ServiceError(
      "CONFLICT",
      "Another customer payment is already bound to this order.",
      409,
    );
  await mutateOrder(stored.order.id, (s) => {
    s.stripePaymentIntentId = intent.id;
    s.order.payment = reconciledPaymentState(
      s.order.payment,
      paymentStateFromIntent(intent.status),
    );
  });
  return intent;
}
async function releaseUnsettledAuthorization(
  id: string,
  intent: Stripe.PaymentIntent,
  reason: string,
  phase: "expired" | "needs_acceptance" | "failed",
) {
  const stored = await mutateOrder(id, (s) => s);
  if (
    stored.order.bookings.some(
      (b) => b.settlement === "settled" || b.fulfillment === "fulfilled",
    )
  ) {
    await mutateOrder(id, (s) => {
      s.operation.phase = "manual_review";
      s.operation.lastError =
        "Supplier purchase or documents already exist. No automatic reversal is assumed.";
    });
    return;
  }
  if (intent.status === "requires_capture") {
    const canceled = await stripeClient().paymentIntents.cancel(
      intent.id,
      {},
      { idempotencyKey: `wayward-release-${id}` },
    );
    if (canceled.livemode || canceled.status !== "canceled")
      throw new ServiceError(
        "PROVIDER_UNAVAILABLE",
        "Customer authorization cancellation could not be confirmed.",
        503,
      );
    await mutateOrder(id, (s) => {
      s.order.payment = "cancelled";
      s.operation.phase = phase;
      s.operation.lastError = reason;
      s.order.state = "failed";
    });
  } else
    await mutateOrder(id, (s) => {
      s.operation.phase = "manual_review";
      s.operation.lastError =
        reason +
        " Captured or uncertain customer funds require manual reconciliation; no supplier reversal is assumed.";
    });
}
export async function reconcileWorkflow(id: string): Promise<Order> {
  let stored = await mutateOrder(id, (s) => s);
  if (
    stored.order.environment === "live" ||
    stored.order.total.kind !== "test_offer"
  )
    throw new ServiceError(
      "CONFLICT",
      "Only test transaction reconciliation is enabled.",
      409,
    );
  const intent = await customerPayment(stored);
  stored = await reconcileSupplier(id);
  if (!intent) return presentOrder(stored);
  if (!["requires_capture", "succeeded"].includes(intent.status))
    return presentOrder(stored);
  const booking = stored.order.bookings[0];
  if (!booking?.providerBookingId) return presentOrder(stored);
  if (booking.settlement !== "settled") {
    if (stored.operation.settlementAttemptedAt) {
      return mutateOrder(id, (s) => {
        if (
          s.order.bookings[0]?.settlement === "pending" ||
          (s.operation.phase === "settling_supplier" &&
            Date.parse(s.operation.settlementAttemptedAt ?? "") >
              Date.now() - 180000)
        ) {
          s.operation.phase = "settling_supplier";
        } else {
          s.operation.phase = "manual_review";
          s.operation.lastError =
            "A supplier payment was already attempted. Reconciliation is read-only; it will not be resubmitted.";
        }
        return presentOrder(s);
      });
    }
    const current = await priceHeldOrder(booking.providerBookingId);
    const deadline = Math.min(
      Date.parse(current.payment_status.payment_required_by ?? ""),
      Date.parse(current.payment_status.price_guarantee_expires_at ?? ""),
    );
    if (!Number.isFinite(deadline) || deadline <= Date.now()) {
      await releaseUnsettledAuthorization(
        id,
        intent,
        "Supplier deadline or price guarantee expired before settlement.",
        "expired",
      );
      return presentOrder(await mutateOrder(id, (s) => s));
    }
    if (supplierSnapshot(current) !== stored.operation.supplierSnapshot) {
      await releaseUnsettledAuthorization(
        id,
        intent,
        "Supplier total or conditions changed after customer acceptance. Revalidate and accept again.",
        "needs_acceptance",
      );
      return presentOrder(await mutateOrder(id, (s) => s));
    }
    const claimed = await mutateOrder(id, (s) => {
      if (s.operation.settlementAttemptedAt) return false;
      s.operation.settlementAttemptedAt = new Date().toISOString();
      s.operation.phase = "settling_supplier";
      return true;
    });
    if (!claimed) return presentOrder(await mutateOrder(id, (s) => s));
    try {
      await settleHeldOrder(current);
    } catch (error) {
      await mutateOrder(id, (s) => {
        s.operation.phase = "manual_review";
        s.operation.lastError =
          error instanceof ServiceError
            ? error.message
            : "Supplier payment outcome could not be validated.";
      });
      if (error instanceof SupplierMutationError && !error.uncertain) {
        const payments = await supplierPayments(booking.providerBookingId);
        if (
          !payments.some(
            (p) => p.status === "succeeded" || p.status === "pending",
          )
        )
          await releaseUnsettledAuthorization(
            id,
            intent,
            "Supplier definitively rejected payment; customer authorization released.",
            "failed",
          );
      }
      return presentOrder(await mutateOrder(id, (s) => s));
    }
    stored = await reconcileSupplier(id);
  }
  if (
    stored.order.bookings[0]?.settlement !== "settled" ||
    stored.order.bookings[0]?.fulfillment !== "fulfilled"
  )
    return mutateOrder(id, (s) => {
      s.operation.phase = "fulfilling";
      return presentOrder(s);
    });
  if (intent.status === "requires_capture") {
    const claimed = await mutateOrder(id, (s) => {
      if (s.operation.captureAttemptedAt) return false;
      s.operation.captureAttemptedAt = new Date().toISOString();
      return true;
    });
    if (!claimed) {
      const observed = await customerPayment(await mutateOrder(id, (s) => s));
      if (observed?.status !== "succeeded")
        return mutateOrder(id, (s) => {
          s.operation.phase =
            Date.parse(s.operation.captureAttemptedAt ?? "") >
            Date.now() - 180000
              ? "fulfilling"
              : "manual_review";
          s.operation.lastError =
            "Capture was attempted but not confirmed; reconcile Stripe before further action.";
          return presentOrder(s);
        });
    } else {
      try {
        const captured = await stripeClient().paymentIntents.capture(
          intent.id,
          {},
          { idempotencyKey: `wayward-capture-${id}` },
        );
        if (captured.livemode || captured.status !== "succeeded")
          throw new Error("Capture not confirmed");
        await mutateOrder(id, (s) => {
          s.order.payment = "captured";
        });
      } catch {
        return mutateOrder(id, (s) => {
          s.operation.phase = "manual_review";
          s.operation.lastError =
            "Supplier tickets exist but customer capture is unconfirmed. Do not repeat supplier purchase or assume the ticket can be refunded.";
          return presentOrder(s);
        });
      }
    }
  }
  return mutateOrder(id, (s) => {
    if (
      s.order.payment === "captured" &&
      s.order.bookings.every(
        (b) => b.settlement === "settled" && b.fulfillment === "fulfilled",
      )
    ) {
      s.order.state = "confirmed";
      s.order.fulfillment = "fulfilled";
      s.operation.phase = "complete";
      delete s.operation.lastError;
    }
    return presentOrder(s);
  });
}
export async function reconcileOrder(
  id: string,
  context: CustomerContext,
): Promise<Order> {
  await authorizedOrder(id, context);
  return reconcileWorkflow(id);
}
