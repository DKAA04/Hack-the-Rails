import {
  OrderSchema,
  OrderWorkflowSchema,
  type Order,
  type OrderWorkflow,
} from "@wayward/contracts";
import type { StoredOrder } from "./index";
import { configuration, credentialsPresent } from "../config";
export function presentOrder(stored: StoredOrder): Order {
  const operation = stored.operation ?? {};
  const booking = stored.order.bookings[0];
  const reasons: string[] = [];
  let phase: OrderWorkflow["phase"] | undefined = operation.phase;
  if (stored.order.state === "confirmed") phase = "complete";
  if (
    phase === "reserving" &&
    operation.reserveStartedAt &&
    Date.parse(operation.reserveStartedAt) < Date.now() - 180000
  ) {
    phase = "manual_review";
    reasons.push(
      "Reservation processing was interrupted or is unresolved; reconcile, do not recreate.",
    );
  }
  if (!phase)
    phase =
      stored.travellers?.length && stored.contact
        ? "ready_to_reserve"
        : "needs_travellers";
  const paymentRequiredBy = operation.supplierPaymentRequiredBy ?? null,
    priceGuaranteeExpiresAt = operation.supplierPriceGuaranteeExpiresAt ?? null;
  if (
    booking?.state === "reserved" &&
    !stored.stripeSessionId &&
    !["manual_review", "needs_acceptance", "failed"].includes(phase ?? "")
  ) {
    const deadline = Math.min(
      Date.parse(paymentRequiredBy ?? ""),
      Date.parse(priceGuaranteeExpiresAt ?? ""),
    );
    if (!Number.isFinite(deadline) || deadline <= Date.now()) {
      phase = "expired";
      reasons.push(
        "Supplier price guarantee/payment deadline expired or is unknown.",
      );
    } else {
      if (!operation.supplierSnapshot)
        reasons.push(
          "Accepted supplier total/conditions/itinerary are not yet verified against the held order.",
        );
      if (deadline - Date.now() < 32 * 60000)
        reasons.push(
          "Supplier guarantee must cover the minimum 30-minute Checkout session plus a safety margin.",
        );
      if (
        booking?.provider === "duffel" &&
        !credentialsPresent("DUFFEL_ACCESS_TOKEN")
      )
        reasons.push(
          "DUFFEL_ACCESS_TOKEN is missing for this held supplier order.",
        );
      if (!credentialsPresent("STRIPE_SECRET_KEY"))
        reasons.push("STRIPE_SECRET_KEY is missing.");
      if (!configuration().databaseConfigured)
        reasons.push("DATABASE_URL is missing.");
      if (
        configuration().environment !== "development" ||
        stored.order.total.kind !== "test_offer"
      )
        reasons.push("Only explicit test transactions are currently enabled.");
      if (!process.env.APP_URL) reasons.push("APP_URL is missing.");
      phase = reasons.length ? "reserved" : "ready_for_checkout";
    }
  }
  if (operation.lastError) reasons.push(operation.lastError);
  const workflowPhase = phase ?? "needs_travellers";
  const nextAction =
    workflowPhase === "needs_travellers"
      ? "provide_travellers"
      : workflowPhase === "ready_to_reserve"
        ? "reserve"
        : workflowPhase === "ready_for_checkout"
          ? "checkout"
          : workflowPhase === "needs_acceptance"
            ? "accept_changes"
            : workflowPhase === "manual_review"
              ? "contact_support"
              : [
                    "reserving",
                    "awaiting_payment",
                    "settling_supplier",
                    "fulfilling",
                  ].includes(workflowPhase)
                ? "poll"
                : "none";
  return OrderSchema.parse({
    ...stored.order,
    environment: stored.order.total.kind === "live_offer" ? "live" : "test",
    workflow: OrderWorkflowSchema.parse({
      phase: workflowPhase,
      nextAction,
      checkoutReady: workflowPhase === "ready_for_checkout",
      reasons,
      retryAfterMs: nextAction === "poll" ? 2000 : null,
      paymentRequiredBy,
      priceGuaranteeExpiresAt,
    }),
  });
}
