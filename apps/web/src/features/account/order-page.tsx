"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink, Notice, PageHeader, SampleDataBadge, Skeleton } from "../../components/ui";
import { api } from "../../lib/api-client";
import { toErrorView, type ErrorView } from "../common/mappers/errors";
import { toOrderView, type OrderView } from "../checkout/mappers/order";
import { sampleOrderView, SAMPLE_ORDERS, type SampleOrderKey } from "./mappers/sample-orders.fixture";
import { OrderStatus } from "./order-status";

type Load = { status: "loading" } | { status: "ready"; order: OrderView } | { status: "error"; error: ErrorView };

export function OrderPage({ orderId, sample }: { orderId: string; sample: string | null }) {
  const sampleKey = sample && sample in SAMPLE_ORDERS ? (sample as SampleOrderKey) : null;
  const [load, setLoad] = useState<Load>({ status: "loading" });

  const fetchOrder = useCallback(() => {
    setLoad({ status: "loading" });
    api
      .getOrder(orderId)
      .then((o) => setLoad({ status: "ready", order: toOrderView(o) }))
      .catch((e) => setLoad({ status: "error", error: toErrorView(e) }));
  }, [orderId]);

  useEffect(() => {
    if (!sampleKey) fetchOrder();
  }, [fetchOrder, sampleKey]);

  if (sampleKey)
    return (
      <>
        <PageHeader
          title="Order preview"
          description={
            <span className="flex flex-wrap items-center gap-2">
              <SampleDataBadge />
              How an order looks in each state. Not a real booking, payment or ticket.
            </span>
          }
        />
        <nav aria-label="Sample states" className="mb-6 flex flex-wrap gap-2">
          {(Object.keys(SAMPLE_ORDERS) as SampleOrderKey[]).map((k) => (
            <Link
              key={k}
              href={`/orders/sample?sample=${k}`}
              aria-current={k === sampleKey ? "page" : undefined}
              className={`rounded-full border px-4 py-2 text-label no-underline ${k === sampleKey ? "border-ink bg-ink text-white" : "border-line-strong bg-surface hover:border-ink"}`}
            >
              {k[0]!.toUpperCase() + k.slice(1)}
            </Link>
          ))}
        </nav>
        <OrderStatus order={sampleOrderView(sampleKey)} sample />
      </>
    );

  return (
    <>
      <PageHeader title="Order status" description={`Reference ${orderId}`} />
      <div aria-live="polite" aria-busy={load.status === "loading"}>
        {load.status === "loading" ? (
          <div className="space-y-4" aria-label="Loading order">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        ) : load.status === "ready" ? (
          <OrderStatus order={load.order} />
        ) : (
          <Notice
            tone={load.error.kind === "not_implemented" ? "info" : "danger"}
            title={
              load.error.kind === "not_implemented"
                ? "Order lookup isn't available yet"
                : load.error.kind === "not_found"
                  ? "We couldn't find that order"
                  : load.error.title
            }
            action={
              <div className="flex flex-wrap gap-2">
                {load.error.retryable ? (
                  <Button variant="ghost" size="sm" icon="refresh" onClick={fetchOrder}>
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
              : load.error.message}
            {load.error.requestId && load.error.kind !== "not_implemented" ? <span className="mt-1 block text-caption">Support code {load.error.requestId}</span> : null}
          </Notice>
        )}
      </div>
    </>
  );
}
