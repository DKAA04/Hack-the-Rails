import assert from "node:assert/strict";
const base = process.env.SMOKE_URL || "http://localhost:3000";
const home = await fetch(base);
assert.equal(home.status, 200);
assert.match(await home.text(), /Go your own way/);
for (const path of ["health", "capabilities"]) {
  const r = await fetch(`${base}/api/${path}`);
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.equal(data.version, 1);
  if (path === "capabilities") {
    assert.ok(
      data.providers.every(
        (p) =>
          ["not_checked", "verified", "failed"].includes(p.connectivity) &&
          p.operations.book !== "available",
      ),
    );
  }
}
const passenger = { id: "p1", age: 30, discounts: [] };
const missingId = "00000000-0000-4000-8000-000000000000";
const missingSearch = await fetch(`${base}/api/search/${missingId}`);
assert.equal(missingSearch.status, 404);
const missingQuote = await fetch(`${base}/api/quotes/revalidate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ searchId: missingId, offerIds: ["missing"] }),
});
assert.equal(missingQuote.status, 404);
for (const path of ["orders/missing", "payments/checkout"]) {
  const r = await fetch(
    `${base}/api/${path}`,
    path.startsWith("payments")
      ? {
          method: "POST",
          body: JSON.stringify({ orderId: "missing", idempotencyKey: "test" }),
        }
      : undefined,
  );
  assert.equal(r.status, 401);
}
const order = await fetch(`${base}/api/orders`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    quoteId: missingId,
    idempotencyKey: "test",
    passengers: [passenger],
    email: "unit@example.invalid",
  }),
});
assert.ok([404, 503].includes(order.status));
const deps = await fetch(`${base}/api/health/dependencies`);
assert.equal(deps.status, 200);
assert.equal((await deps.json()).stripe.checkoutEnabled, false);
const invalid = await fetch(`${base}/api/search`, {
  method: "POST",
  body: "{}",
});
assert.equal(invalid.status, 400);
assert.equal((await invalid.json()).error.code, "INVALID_REQUEST");
const webhook = await fetch(`${base}/api/webhooks/stripe`, {
  method: "POST",
  body: "{}",
});
assert.ok([401, 503].includes(webhook.status));
assert.equal(webhook.ok, false);
console.log(
  "PASS: home, health, dependency inspection, missing search/quote, protected orders/checkout, validation and webhook fail-closed.",
);
