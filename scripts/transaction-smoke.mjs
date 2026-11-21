import { loadEnvFile } from "node:process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
loadEnvFile("apps/web/.env.local");
const base = process.env.APP_URL;
if (!base) throw new Error("APP_URL is missing");
let cookie = "";
async function request(path, method = "GET", body, sendSession = true) {
  const r = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie && sendSession ? { cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { response: r, body: await r.json() };
}
async function main() {
  if (
    process.argv.includes("--execute-test-transaction") &&
    existsSync(".local/http-workflow-test.json")
  ) {
    console.log(
      "Existing workflow checkpoint found. Use complete-transaction-test.mjs/reconcile-test.mjs; do not create a second booking.",
    );
    return;
  }
  const deps = await request("/health/dependencies");
  assert.equal(deps.response.status, 200);
  assert.equal(
    deps.body.checkoutPolicy,
    "per_order_test_only",
    "Wrong/stale server: transaction checkout policy missing",
  );
  async function place(code) {
    const r = await request(`/places?query=${code}&limit=20&modes=flight`);
    assert.equal(r.response.status, 200);
    const result = r.body.places.find((p) =>
      p.providerIds.some((ref) => ref.provider === "iata" && ref.id === code),
    );
    assert.ok(result, `Resolved supplier place ${code}`);
    return result;
  }
  const [origin, destination] = await Promise.all([place("JFK"), place("EWR")]);
  const departureDate = new Date(Date.now() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const passengers = [{ id: "p1", age: 30, discounts: [] }];
  const intent = {
    version: 1,
    origin,
    destination,
    departureDate,
    returnDate: null,
    passengers,
    bags: { cabin: 0, checked: 0, bicycles: 0 },
    modes: ["flight"],
    preferences: {
      sort: "cheapest",
      maxTransfers: 0,
      accessible: null,
      cabin: null,
    },
    naturalLanguage: null,
  };
  const started = await request("/search", "POST", intent);
  assert.equal(started.response.status, 200);
  const search = await request(`/search/${started.body.searchId}`);
  assert.equal(search.response.status, 200);
  assert.ok(search.body.offers.length > 0);
  assert.ok(
    search.body.offers.every(
      (o) => o.environment === "test" && o.price.kind === "test_offer",
    ),
  );
  const offer = search.body.offers.find(
    (o) =>
      o.bookingRequirements?.holdSupported === true &&
      o.price.completeness === "complete" &&
      o.itinerary.compatibility === "verified",
  );
  assert.ok(offer, "No complete direct test hold offer available");
  const refreshed = await request("/quotes/revalidate", "POST", {
    searchId: started.body.searchId,
    offerIds: [offer.id],
  });
  assert.equal(refreshed.response.status, 200);
  assert.ok(["valid", "changed"].includes(refreshed.body.status));
  const body = {
    quoteId: refreshed.body.quoteId,
    idempotencyKey: `verification-${randomUUID()}`,
    passengers,
    email: "sandbox@example.com",
    acceptChanges: true,
  };
  const created = await request("/orders", "POST", body);
  if (
    !deps.body.database.configured ||
    deps.body.database.connectivity !== "verified"
  ) {
    assert.equal(created.response.status, 503);
    console.log(
      JSON.stringify({
        service: "http_supplier_search_reprice",
        status: "externally_verified",
        environment: "test",
        offerCount: search.body.offers.length,
        searchPersistence: deps.body.searchStorage,
        orderTransactions: "blocked_by_access",
        missing: !deps.body.database.configured
          ? "DATABASE_URL"
          : "reachable private-schema SQL access",
        supabaseVerified: false,
      }),
    );
    return;
  }
  assert.equal(created.response.status, 200, JSON.stringify(created.body));
  const header = created.response.headers.get("set-cookie");
  assert.ok(header?.includes("HttpOnly"));
  cookie = header.split(";")[0];
  const id = created.body.id;
  const duplicates = await Promise.all([
    request("/orders", "POST", body),
    request("/orders", "POST", body),
  ]);
  assert.ok(
    duplicates.every((d) => d.response.status === 200 && d.body.id === id),
  );
  const noSession = await request(`/orders/${id}`, "GET", undefined, false);
  assert.equal(noSession.response.status, 401);
  const savedCookie = cookie;
  cookie = `wayward_session=${randomBytes(32).toString("hex")}`;
  const foreign = await request(`/orders/${id}`);
  assert.equal(foreign.response.status, 404);
  cookie = savedCookie;
  const own = await request(`/orders/${id}`);
  assert.equal(own.response.status, 200);
  const travellers = [
    {
      passengerId: "p1",
      givenName: "Wayward",
      familyName: "TestTraveller",
      bornOn: `${Number(departureDate.slice(0, 4)) - 30}-01-01`,
      title: "mr",
      gender: "m",
      identityDocuments: [],
    },
  ];
  const contact = {
    email: "sandbox@example.com",
    phoneNumber: "+442080160508",
  };
  const updated = await request(`/orders/${id}/travellers`, "PUT", {
    travellers,
    contact,
  });
  assert.equal(updated.response.status, 200);
  console.log(
    JSON.stringify({
      service: "http_durable_orders",
      status: "externally_verified",
      searchPersistence: "postgresql",
      duplicateRequests: true,
      ownSessionAccess: true,
      foreignSessionRejected: true,
      travellerUpdate: true,
    }),
  );
  mkdirSync(".local", { recursive: true });
  const checkpoint = { base, orderId: id, cookie, environment: "test" };
  writeFileSync(".local/http-workflow-test.json", JSON.stringify(checkpoint), {
    mode: 0o600,
  });
  if (!process.argv.includes("--execute-test-transaction")) return;
  const reserveKey = randomUUID();
  const reserved = await request(`/orders/${id}/reserve`, "POST", {
    idempotencyKey: reserveKey,
  });
  assert.equal(reserved.response.status, 200, JSON.stringify(reserved.body));
  writeFileSync(
    ".local/http-workflow-test.json",
    JSON.stringify({
      ...checkpoint,
      reserveKey,
      supplierOrderId: reserved.body.bookings[0]?.providerBookingId,
    }),
    { mode: 0o600 },
  );
  assert.equal(
    reserved.body.workflow.checkoutReady,
    true,
    JSON.stringify(reserved.body.workflow),
  );
  const checkout = await request("/payments/checkout", "POST", {
    orderId: id,
    idempotencyKey: `checkout-${id}`,
  });
  assert.equal(checkout.response.status, 200, JSON.stringify(checkout.body));
  writeFileSync(
    ".local/http-workflow-test.json",
    JSON.stringify({
      ...checkpoint,
      reserveKey,
      sessionId: checkout.body.sessionId,
      redirectUrl: checkout.body.redirectUrl,
    }),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      service: "http_reserved_order_checkout",
      status: "externally_verified",
      environment: "test",
      supplierReservation: true,
      hostedCheckout: true,
      customerAction:
        "Complete the test Checkout URL saved privately in .local/http-workflow-test.json, then POST the protected reconciliation endpoint. No ticket issuance is claimed until that succeeds.",
    }),
  );
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      service: "http_transaction_smoke",
      status: "failed",
      message: error.message,
    }),
  );
  process.exitCode = 1;
});
