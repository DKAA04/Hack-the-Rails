import { loadEnvFile } from "node:process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { getRecord, postgresPool } from "../packages/server/src/db/records";
import { StoredOrderSchema } from "../packages/server/src/orders";
import {
  findSupplierOrders,
  supplierPayments,
} from "../packages/server/src/providers/duffel/transactions";
import { stripeClient } from "../packages/server/src/payments/stripe/client";
loadEnvFile("apps/web/.env.local");
async function main() {
  const state = JSON.parse(
    readFileSync(".local/http-workflow-test.json", "utf8"),
  );
  const headers = { cookie: state.cookie };
  const replay = await Promise.all([
    fetch(`${state.base}/api/orders/${state.orderId}/reconcile`, {
      method: "POST",
      headers,
    }),
    fetch(`${state.base}/api/orders/${state.orderId}/reconcile`, {
      method: "POST",
      headers,
    }),
  ]);
  assert.ok(replay.every((r) => r.status === 200));
  const stored = StoredOrderSchema.parse(
    await getRecord("order", state.orderId),
  );
  const child = stored.order.bookings[0]!;
  assert.ok(child.providerBookingId);
  assert.ok(stored.stripePaymentIntentId);
  const [orders, payments, intent] = await Promise.all([
    findSupplierOrders(stored.quote.offers[0]!.providerOfferId, state.orderId),
    supplierPayments(child.providerBookingId!),
    stripeClient().paymentIntents.retrieve(stored.stripePaymentIntentId!),
  ]);
  assert.equal(orders.length, 1);
  assert.equal(payments.filter((p) => p.status === "succeeded").length, 1);
  assert.equal(intent.livemode, false);
  assert.equal(intent.status, "succeeded");
  assert.equal(intent.amount_capturable, 0);
  assert.ok("total" in stored.order.total);
  if ("total" in stored.order.total)
    assert.equal(intent.amount_received, stored.order.total.total.amount);
  assert.equal(stored.order.state, "confirmed");
  assert.equal(stored.order.fulfillment, "fulfilled");
  const cookieMissing = await fetch(
    `${state.base}/api/orders/${state.orderId}`,
  );
  assert.equal(cookieMissing.status, 401);
  console.log(
    JSON.stringify({
      capability: "completed_workflow_replay",
      status: "externally_verified",
      environment: "test",
      concurrentReconciliation: true,
      supplierOrderCount: orders.length,
      succeededSupplierPaymentCount: payments.filter(
        (p) => p.status === "succeeded",
      ).length,
      customerIntentStatus: intent.status,
      acceptedAmountCaptured: true,
      unauthenticatedTicketAccessRejected: true,
      databasePersistence: "postgresql",
    }),
  );
}
main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        capability: "completed_workflow_replay",
        status: "failed",
        message: error.message,
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) await postgresPool().end();
  });
