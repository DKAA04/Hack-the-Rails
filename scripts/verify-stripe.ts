import { loadEnvFile } from "node:process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { stripeClient } from "../packages/server/src/payments/stripe/client";
import { checkoutParameters } from "../packages/server/src/payments/stripe/session";
import {
  retrieveSupplierOrder,
  supplierPayments,
  supplierBooking,
} from "../packages/server/src/providers/duffel/transactions";
import { decimalMoney } from "../packages/server/src/pricing/money";
import { OrderSchema } from "../packages/contracts/src/index";
loadEnvFile("apps/web/.env.local");
async function main() {
  const stripe = stripeClient();
  const balance = await stripe.balance.retrieve();
  if (balance.livemode) throw new Error("Refusing live Stripe access");
  console.log(
    JSON.stringify({
      service: "stripe_account",
      status: "externally_verified",
      environment: "test",
    }),
  );
  if (
    !process.argv.includes("--create-test-checkout") &&
    !process.argv.includes("--authorize-and-capture-test-only")
  )
    return;
  const checkpoint = JSON.parse(
    readFileSync(".local/supplier-hold-success-test.json", "utf8"),
  );
  const supplier = await retrieveSupplierOrder(checkpoint.supplierOrderId);
  if (supplier.live_mode) throw new Error("Refusing live supplier data");
  const payments = await supplierPayments(supplier.id);
  const child = supplierBooking(
    supplier,
    {
      id: "verification-child",
      provider: "duffel",
      providerBookingId: supplier.id,
      offerIds: [checkpoint.offerId],
      state: "unknown",
      settlement: "not_started",
      fulfillment: "not_started",
      tickets: [],
      aftersales: {
        refund: "unknown",
        exchange: "unknown",
        cancellation: "unknown",
      },
    },
    payments,
  );
  if (child.fulfillment !== "fulfilled" || child.settlement !== "settled")
    throw new Error("Supplier test fulfillment must be confirmed first");
  const id = `verification-${supplier.id}`;
  const order = OrderSchema.parse({
    id,
    quoteId: checkpoint.offerId,
    state: "pending",
    createdAt: new Date().toISOString(),
    total: {
      kind: "test_offer",
      total: decimalMoney(supplier.total_amount, supplier.total_currency),
      completeness: "complete",
      missingComponents: [],
      breakdown: [],
      observedAt: new Date().toISOString(),
    },
    payment: "not_started",
    fulfillment: "fulfilled",
    bookings: [child],
    environment: "test",
  });
  if (process.argv.includes("--authorize-and-capture-test-only")) {
    const amount = decimalMoney(supplier.total_amount, supplier.total_currency);
    const authorization = await stripe.paymentIntents.create(
      {
        amount: amount.amount,
        currency: amount.currency.toLowerCase(),
        capture_method: "manual",
        payment_method: "pm_card_visa",
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        metadata: { verificationSupplierOrder: supplier.id },
      },
      {
        idempotencyKey: `wayward-manual-authorization-verification-${supplier.id}`,
      },
    );
    if (authorization.livemode) throw new Error("Unexpected live intent");
    console.log(
      JSON.stringify({
        service: "stripe_manual_authorization",
        status: "externally_verified",
        environment: "test",
        state: authorization.status,
      }),
    );
    if (!["requires_capture", "succeeded"].includes(authorization.status))
      throw new Error("Test payment needs additional action");
    const captured =
      authorization.status === "requires_capture"
        ? await stripe.paymentIntents.capture(
            authorization.id,
            {},
            {
              idempotencyKey: `wayward-manual-capture-verification-${supplier.id}`,
            },
          )
        : authorization;
    if (captured.livemode || captured.status !== "succeeded")
      throw new Error("Test capture not confirmed");
    writeFileSync(
      ".local/stripe-capture-verification.json",
      JSON.stringify({
        paymentIntentId: captured.id,
        supplierOrderId: supplier.id,
        environment: "test",
        status: captured.status,
      }),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        service: "stripe_manual_capture",
        status: "externally_verified",
        environment: "test",
        state: captured.status,
        actualSupplierTestDocumentsVerified: true,
        postgresWorkflowVerified: false,
      }),
    );
    if (!process.argv.includes("--create-test-checkout")) return;
  }
  const path = ".local/stripe-checkout-verification.json";
  const existing = existsSync(path)
    ? JSON.parse(readFileSync(path, "utf8"))
    : null;
  const params =
    existing?.params ??
    checkoutParameters({ order, email: "sandbox@example.com" });
  writeFileSync(path, JSON.stringify({ params, started: true }), {
    mode: 0o600,
  });
  const session = await stripe.checkout.sessions.create(params, {
    idempotencyKey: `wayward-checkout-verification-${supplier.id}`,
  });
  if (session.livemode || !session.url)
    throw new Error("Unexpected Stripe Checkout response");
  const expired =
    session.status === "open"
      ? await stripe.checkout.sessions.expire(session.id)
      : session;
  writeFileSync(
    path,
    JSON.stringify({
      params,
      sessionId: session.id,
      status: expired.status,
      environment: "test",
    }),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      service: "stripe_checkout",
      status: "externally_verified",
      environment: "test",
      hostedUrlReturned: true,
      finalState: expired.status,
      paymentAuthorized: false,
      paymentCaptured: false,
      postgresWorkflowVerified: false,
    }),
  );
}
main().catch((error) => {
  console.error(
    JSON.stringify({
      service: "stripe",
      status: "failed",
      type: error.type ?? null,
      code: error.code ?? null,
      parameter: error.param ?? null,
      message:
        "Stripe verification failed; no live transaction was authorized.",
    }),
  );
  process.exitCode = 1;
});
