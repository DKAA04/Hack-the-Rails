"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink, Notice, PageHeader, SampleDataBadge, Skeleton } from "../../components/ui";
import { api } from "../../lib/api-client";
import { toErrorView, toPendingEndpointErrorView, type ErrorView } from "../common/mappers/errors";
import { toOrderView, type NextAction } from "../checkout/mappers/order";
import { PaymentSlot, type PaymentSlotState } from "../checkout/payment-slot";
import { idempotencyKeyFor } from "../checkout/idempotency";
import { sampleOrderView, SAMPLE_ORDERS, type SampleOrderKey } from "./mappers/sample-orders.fixture";
import { OrderStatus } from "./order-status";
import { OrderWorkflowPanel } from "./order-workflow";
import { useOrder } from "./use-order";

const SAMPLE_LABEL: Record<SampleOrderKey, string> = {
  pending: "Waiting for tickets",
  reserved: "Ready to pay",
  confirmed: "Complete",
  review: "Manual review",
  failed: "Failed",
  cancelled: "Expired",
};

export function OrderPage({
  orderId,
  sample,
  checkoutReturn = null,
}: {
  orderId: string;
  sample: string | null;
  checkoutReturn?: "returned" | "cancelled" | null;
}) {
  const sampleKey = sample && sample in SAMPLE_ORDERS ? (sample as SampleOrderKey) : null;
  if (sampleKey) return <SampleOrder sampleKey={sampleKey} />;
  return <LiveOrder orderId={orderId} checkoutReturn={checkoutReturn} />;
}

function SampleOrder({ sampleKey }: { sampleKey: SampleOrderKey }) {
  const order = sampleOrderView(sampleKey);
  return (
    <>
      <PageHeader
        title="Order preview"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <SampleDataBadge />
            How an order looks at each stage. Not a real booking, payment or ticket.
          </span>
        }
      />
      <nav aria-label="Sample stages" className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(SAMPLE_ORDERS) as SampleOrderKey[]).map((k) => (
          <Link
            key={k}
            href={`/orders/sample?sample=${k}`}
            aria-current={k === sampleKey ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-label no-underline ${k === sampleKey ? "border-ink bg-ink text-white" : "border-line-strong bg-surface hover:border-ink"}`}
          >
            {SAMPLE_LABEL[k]}
          </Link>
        ))}
      </nav>
      <div className="space-y-6">
        <OrderWorkflowPanel order={order} polling={false} pollMs={null} lastChecked={null} />
        <OrderStatus order={order} sample />
      </div>
    </>
  );
}

function LiveOrder({ orderId, checkoutReturn }: { orderId: string; checkoutReturn: "returned" | "cancelled" | null }) {
  // Returning from Checkout: reconcile first (POST /reconcile, then GET).
  const { load, refresh, reconcile, setOrder, polling, pollMs, lastChecked, syncing, syncError } = useOrder(orderId, undefined, {
    reconcileOnLoad: checkoutReturn !== null,
  });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ErrorView | null>(null);
  const [payment, setPayment] = useState<PaymentSlotState | null>(null);

  async function onAction(a: NextAction) {
    if (load.status !== "ready") return;
    setBusy(true);
    setActionError(null);
    try {
      if (a === "reserve") setOrder(toOrderView(await api.reserve(orderId, { idempotencyKey: idempotencyKeyFor("reserve", orderId) })));
      else if (a === "checkout") {
        const s = await api.checkout({ orderId, idempotencyKey: idempotencyKeyFor("checkout", orderId) });
        setPayment({ kind: "redirect", url: s.redirectUrl });
        window.location.assign(s.redirectUrl);
      }
    } catch (e) {
      const err = a === "reserve" ? toPendingEndpointErrorView(e) : toErrorView(e);
      setActionError(err);
      if (a === "checkout") setPayment({ kind: "unavailable", error: err });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Order status" description={`Order reference ${orderId}`} />
      {checkoutReturn === "cancelled" ? (
        <Notice tone="neutral" title="Payment cancelled" className="mb-6">
          You left the payment page without paying, so nothing was charged. The seller&apos;s hold stays until its deadline.
        </Notice>
      ) : checkoutReturn === "returned" && (load.status === "loading" || syncing) ? (
        <p className="mb-6 text-body-sm text-text-muted" role="status">
          Back from payment. We&apos;re checking the result with the payment provider and the seller.
        </p>
      ) : null}
      <div aria-busy={load.status === "loading"}>
        {load.status === "loading" || load.status === "idle" ? (
          <div className="space-y-4" aria-label="Loading order">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        ) : load.status === "ready" ? (
          <div className="space-y-6">
            <OrderWorkflowPanel
              order={load.order}
              onAction={onAction}
              busy={busy}
              actionError={actionError}
              polling={polling}
              pollMs={pollMs}
              lastChecked={lastChecked}
              syncing={syncing}
              syncError={syncError}
              onCheckAgain={() => void reconcile()}
              travellerAction={
                <Notice tone="info" title="Traveller details are needed">
                  For privacy, traveller details are never saved in your browser, so they need to be entered again from
                  your trip&apos;s checkout.
                  <span className="mt-3 block">
                    <ButtonLink href="/checkout" size="sm">
                      Go to checkout
                    </ButtonLink>
                  </span>
                </Notice>
              }
            />
            {load.order.workflow?.nextAction === "accept_changes" ? (
              <Notice tone="warn" title="Accept the changes from your trip">
                Changes need a fresh price check and a new draft order. Open your trip and continue to checkout to see the
                new terms.
              </Notice>
            ) : null}
            {payment ? (
              <section className="rounded-lg border border-line bg-surface p-4 sm:p-6" aria-label="Payment">
                <PaymentSlot state={payment} />
              </section>
            ) : null}
            <OrderStatus order={load.order} />
          </div>
        ) : (
          <Notice
            tone={load.error.kind === "not_implemented" ? "info" : "danger"}
            title={
              load.error.kind === "not_implemented"
                ? "Order lookup isn't available yet"
                : load.error.kind === "not_found"
                  ? "We couldn't find that order in this browser"
                  : load.error.code === "UNAUTHORIZED"
                    ? "This browser can't open that order"
                    : load.error.title
            }
            action={
              <div className="flex flex-wrap gap-2">
                {load.error.retryable ? (
                  <Button variant="ghost" size="sm" icon="refresh" onClick={() => void refresh()}>
                    Try again
                  </Button>
                ) : null}
                <ButtonLink href="/orders" variant="ghost" size="sm">
                  All orders
                </ButtonLink>
              </div>
            }
          >
            {load.error.kind === "not_implemented"
              ? "Wayward can't look up orders yet. If a seller emailed you, their confirmation is the source of truth."
              : load.error.kind === "not_found" || load.error.code === "UNAUTHORIZED"
                ? "Orders open only in the browser session that created them, and there are no accounts yet. If you cleared cookies or switched browser, use the seller's confirmation email."
                : load.error.message}
            {load.error.requestId && load.error.kind === "unknown" ? (
              <span className="mt-1 block text-caption">Support code {load.error.requestId}</span>
            ) : null}
          </Notice>
        )}
      </div>
    </>
  );
}
