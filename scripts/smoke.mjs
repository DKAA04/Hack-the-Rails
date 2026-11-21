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
          p.connectivity === "not_checked" &&
          p.operations.book !== "available" && p.operations.fulfillment !== "available",
      ),
    );
  }
}
const place = {
  id: "city:paris",
  name: "Paris",
  kind: "city",
  countryCode: "FR",
  timeZone: "Europe/Paris",
  providerIds: [],
  coordinates: null,
};
const passenger = { id: "p1", age: 30, discounts: [] };
const intent = {
  version: 1,
  origin: place,
  destination: {
    ...place,
    id: "city:berlin",
    name: "Berlin",
    timeZone: "Europe/Berlin",
  },
  departureDate: "2026-12-01",
  returnDate: null,
  passengers: [passenger],
  bags: { cabin: 1, checked: 0, bicycles: 0 },
  modes: [
    "flight",
    "rail",
    "coach",
    "ferry",
    "local_transit",
    "walking",
    "transfer",
  ],
  preferences: {
    sort: "cheapest",
    maxTransfers: null,
    accessible: null,
    cabin: null,
  },
  naturalLanguage: null,
};
for (const [path, body] of [
  [
    "quotes/revalidate",
    { offerIds: ["offer:opaque"], searchId: "00000000-0000-4000-8000-000000000000" },
  ],
  [
    "orders",
    {
      quoteId: "quote:opaque",
      idempotencyKey: "test-key",
      passengers: [passenger],
      email: "test@example.com",
    },
  ],
  [
    "payments/checkout",
    { orderId: "order:opaque", idempotencyKey: "test-key" },
  ],
]) {
  const r = await fetch(`${base}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(r.status, path === "quotes/revalidate" ? 404 : 501, path);
  assert.equal(
    (await r.json()).error.code,
    path === "quotes/revalidate" ? "NOT_FOUND" : "NOT_IMPLEMENTED",
  );
}
for (const path of ["search/missing", "orders/missing"]) {
  const r = await fetch(`${base}/api/${path}`);
  assert.equal(r.status, path.startsWith("search/") ? 404 : 501);
}
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
assert.ok([501, 503].includes(webhook.status));
assert.equal(webhook.ok, false);
console.log(
  "PASS: home, health, capability honesty, all disabled business routes, validation and webhook fail-closed.",
);
