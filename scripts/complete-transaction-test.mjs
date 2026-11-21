import { loadEnvFile } from "node:process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
loadEnvFile("apps/web/.env.local");
const path = ".local/http-workflow-test.json";
const state = JSON.parse(readFileSync(path, "utf8"));
if (state.base !== process.env.APP_URL || state.environment !== "test")
  throw new Error("Checkpoint origin/environment mismatch");
const save = () => writeFileSync(path, JSON.stringify(state), { mode: 0o600 });
async function request(suffix, body) {
  const response = await fetch(`${state.base}/api${suffix}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie: state.cookie,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { response, body: await response.json() };
}
try {
  let order = (await request(`/orders/${state.orderId}`)).body;
  if (order.environment !== "test")
    throw new Error("Refusing a non-test parent order");
  if (
    ["manual_review", "failed", "expired", "needs_acceptance"].includes(
      order.workflow?.phase,
    )
  ) {
    console.log(
      JSON.stringify({
        stage: "existing_order",
        phase: order.workflow.phase,
        reasons: order.workflow.reasons,
        automaticRetry: false,
      }),
    );
    process.exitCode = 1;
  } else {
    if (!order.bookings[0]?.providerBookingId) {
      state.reserveKey ??= randomUUID();
      save();
      const reserved = await request(`/orders/${state.orderId}/reserve`, {
        idempotencyKey: state.reserveKey,
      });
      assert.equal(
        reserved.response.status,
        200,
        JSON.stringify(reserved.body),
      );
      order = reserved.body;
      state.supplierOrderId = order.bookings[0]?.providerBookingId;
      save();
    }
    console.log(
      JSON.stringify({
        stage: "http_supplier_reservation",
        environment: "test",
        phase: order.workflow?.phase,
        checkoutReady: order.workflow?.checkoutReady,
        reasons: order.workflow?.reasons,
      }),
    );
    if (!state.sessionId) {
      assert.equal(order.workflow?.checkoutReady, true);
      const checkout = await request("/payments/checkout", {
        orderId: state.orderId,
        idempotencyKey: `checkout-${state.orderId}`,
      });
      assert.equal(
        checkout.response.status,
        200,
        JSON.stringify(checkout.body),
      );
      state.sessionId = checkout.body.sessionId;
      state.redirectUrl = checkout.body.redirectUrl;
      save();
    }
    console.log(
      JSON.stringify({
        stage: "http_checkout",
        environment: "test",
        created: true,
        hostedUrlSavedPrivately: true,
        requiresTestCardCompletion: true,
      }),
    );
  }
} catch (error) {
  console.error(
    JSON.stringify({
      stage: "http_transaction_completion",
      status: "failed",
      message: error.message,
    }),
  );
  process.exitCode = 1;
}
