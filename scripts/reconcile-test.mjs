import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const state = JSON.parse(
  readFileSync(".local/http-workflow-test.json", "utf8"),
);
if (state.environment !== "test") throw new Error("Refusing live workflow");
async function main() {
  const reconciled = await fetch(
    `${state.base}/api/orders/${state.orderId}/reconcile`,
    { method: "POST", headers: { cookie: state.cookie } },
  );
  const body = await reconciled.json();
  assert.equal(reconciled.status, 200, JSON.stringify(body));
  const response = await fetch(`${state.base}/api/orders/${state.orderId}`, {
    headers: { cookie: state.cookie },
  });
  assert.equal(response.status, 200);
  const order = await response.json();
  const evidence = {
    capability: "durable_test_workflow",
    verifiedAt: new Date().toISOString(),
    environment: order.environment,
    state: order.state,
    phase: order.workflow?.phase,
    payment: order.payment,
    fulfillment: order.fulfillment,
    bookings: order.bookings.map((b) => ({
      state: b.state,
      settlement: b.settlement,
      fulfillment: b.fulfillment,
      supplierOrderPresent: !!b.providerBookingId,
      actualSupplierDocuments: b.supplierDocuments?.length ?? 0,
      issuedAtKnown:
        b.supplierDocuments?.every((d) => d.issuedAt !== null) ?? false,
    })),
    reasons: order.workflow?.reasons,
  };
  writeFileSync(
    ".local/transaction-workflow-evidence.json",
    JSON.stringify(evidence),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(evidence));
  if (process.argv.includes("--require-complete")) {
    assert.equal(order.state, "confirmed");
    assert.equal(order.payment, "captured");
    assert.equal(order.fulfillment, "fulfilled");
    assert.ok(
      order.bookings.every(
        (b) =>
          b.settlement === "settled" &&
          b.fulfillment === "fulfilled" &&
          b.supplierDocuments?.some(
            (d) => d.documentType === "electronic_ticket" && d.reference,
          ),
      ),
    );
    console.log(
      "PASS: actual persisted parent/child order, customer test capture, supplier test settlement and returned fulfillment reference.",
    );
  }
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      capability: "durable_test_workflow",
      status: "failed",
      message: error.message,
    }),
  );
  process.exitCode = 1;
});
