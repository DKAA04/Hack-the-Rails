import { loadEnvFile } from "node:process";
import { IdSchema } from "../packages/contracts/src";
import { postgresPool } from "../packages/server/src/db/records";
import { StoredOrderSchema } from "../packages/server/src/orders";
import { stripeClient } from "../packages/server/src/payments/stripe/client";
import {
  findSupplierOrders,
  retrieveSupplierOrder,
  supplierPayments,
} from "../packages/server/src/providers/duffel/transactions";

// Operator-only: SELECT and documented supplier/Stripe retrievals. Never calls
// migration, reconciliation, reservation, settlement, capture or refund paths.
loadEnvFile("apps/web/.env.local");
async function main() {
  const id = IdSchema.parse(process.argv[2]);
  if (process.env.WAYWARD_ENV !== "development")
    throw new Error("Explicit development configuration required");
  const pool = postgresPool();
  try {
    const row = await pool.query(
      "SELECT payload FROM wayward_private.records WHERE namespace='order' AND id=$1",
      [id],
    );
    const stored = StoredOrderSchema.parse(row.rows[0]?.payload);
    if (stored.order.total.kind !== "test_offer")
      throw new Error("Test order required");
    const child = stored.order.bookings[0];
    if (stored.order.bookings.length !== 1 || child?.provider !== "duffel")
      throw new Error(
        "Only the implemented single-supplier test path can be verified",
      );
    const events = await pool.query(
      "SELECT id,payload->>'type' AS type,payload->>'state' AS state FROM wayward_private.records WHERE namespace='webhook' AND payload->>'orderId'=$1",
      [id],
    );
    const session = stored.stripeSessionId
      ? await stripeClient().checkout.sessions.retrieve(
          stored.stripeSessionId,
          { expand: ["payment_intent"] },
        )
      : null;
    if (session?.livemode) throw new Error("Live Checkout refused");
    const intent =
      session && typeof session.payment_intent === "object"
        ? session.payment_intent
        : null;
    const [matches, supplier, payments] = child.providerBookingId
      ? await Promise.all([
          findSupplierOrders(stored.quote.offers[0]!.providerOfferId, id),
          retrieveSupplierOrder(child.providerBookingId),
          supplierPayments(child.providerBookingId),
        ])
      : [null, null, null];
    if (supplier?.live_mode || payments?.some((p) => p.live_mode))
      throw new Error("Live supplier response refused");
    const accepted =
      "total" in stored.order.total ? stored.order.total.total : null;
    console.log(
      JSON.stringify({
        verifiedAt: new Date().toISOString(),
        orderId: id,
        readOnly: true,
        orderState: stored.order.state,
        workflow: stored.operation.phase ?? null,
        payment: stored.order.payment,
        settlement: child.settlement,
        fulfillment: child.fulfillment,
        stripe: session
          ? {
              test: !session.livemode,
              checkoutStatus: session.status,
              paymentIntentStatus: intent?.status ?? null,
              bindingMatches:
                session.metadata?.waywardOrderId === id &&
                session.client_reference_id === id &&
                intent?.metadata.waywardOrderId === id,
              capturedTotalMatches: Boolean(
                accepted &&
                  intent?.status === "succeeded" &&
                  intent.amount_received === accepted.amount &&
                  intent.currency.toUpperCase() === accepted.currency,
              ),
              returnOrigin: session.success_url
                ? new URL(session.success_url).origin
                : null,
            }
          : null,
        supplier: supplier
          ? {
              test: !supplier.live_mode,
              supplierOrderId: supplier.id,
              matchingOrders: matches?.length ?? null,
              successfulPayments:
                payments?.filter((p) => p.status === "succeeded").length ??
                null,
              awaitingPayment: supplier.payment_status.awaiting_payment,
              actualDocuments: supplier.documents.map((d) => ({
                type: d.type,
                reference: d.unique_identifier,
              })),
            }
          : null,
        webhookEvents: events.rows,
        browserSessionContinuity:
          "requires browser observation; not established by SQL reads",
      }),
    );
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    JSON.stringify({
      status: "verification_failed",
      readOnly: true,
      message:
        "Check order ID, explicit test configuration and service access. No purchase or payment mutation was attempted.",
    }),
  );
  process.exitCode = 1;
});
