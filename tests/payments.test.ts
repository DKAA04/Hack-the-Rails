import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyStripeEvent } from "../packages/server/src/payments/stripe/verification";
import {
  paymentStateFromIntent,
  reconciledPaymentState,
} from "../packages/server/src/payments/stripe/state";
import { customerSession } from "../packages/server/src/auth";
import { stripeClient } from "../packages/server/src/payments/stripe/client";
const secret = "whsec_unit_test_only_not_a_real_credential";
function signature(raw: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`;
}
test("Stripe verifies exact raw body and rejects tampering and stale signed replays", () => {
  const raw = JSON.stringify({
    id: "evt_test_unit",
    object: "event",
    livemode: false,
    data: { object: {} },
    type: "test.event",
  });
  assert.equal(
    verifyStripeEvent(raw, signature(raw), secret).id,
    "evt_test_unit",
  );
  assert.throws(() => verifyStripeEvent(raw + " ", signature(raw), secret));
  assert.throws(() =>
    verifyStripeEvent(
      raw,
      signature(raw, Math.floor(Date.now() / 1000) - 3600),
      secret,
    ),
  );
  assert.throws(() => verifyStripeEvent(raw, null, secret));
});
test("Stripe authorization and capture are distinct; unknown payment states cannot confirm", () => {
  assert.equal(paymentStateFromIntent("requires_capture"), "authorized");
  assert.equal(paymentStateFromIntent("succeeded"), "captured");
  assert.throws(() => paymentStateFromIntent("future_unknown_state"));
});
test("customer order sessions use opaque HttpOnly cookies and block cross-origin requests", () => {
  const request = new Request("http://localhost:3000/api/orders");
  const created = customerSession(request, true);
  assert.ok(created.cookie?.includes("HttpOnly; SameSite=Strict; Path=/api"));
  const cookie = created.cookie!.split(";")[0]!;
  const reused = customerSession(new Request(request, { headers: { cookie } }));
  assert.equal(reused.context.ownerHash, created.context.ownerHash);
  assert.equal(reused.cookie, null);
  assert.throws(() => customerSession(request));
  assert.throws(() =>
    customerSession(
      new Request(request, {
        headers: { origin: "https://untrusted.invalid" },
      }),
      true,
    ),
  );
});
test("development refuses Stripe live-mode keys without sending requests", () => {
  const previous = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_live_unit_test_placeholder";
  try {
    assert.throws(() => stripeClient());
  } finally {
    if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous;
  }
});

test("concurrent stale webhook observations cannot regress captured or cancelled payments", () => {
  assert.equal(reconciledPaymentState("captured", "authorized"), "captured");
  assert.equal(reconciledPaymentState("cancelled", "processing"), "cancelled");
  assert.equal(reconciledPaymentState("failed", "captured"), "captured");
});
