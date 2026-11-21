"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../../components/icons";
import { Button, PageHeader, SampleDataBadge } from "../../components/ui";
import { LOCAL_ORDERS_KEY } from "../checkout/checkout-view";

export function OrdersList() {
  const router = useRouter();
  const [ids, setIds] = useState<string[] | null>(null);
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      setIds(JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) ?? "[]") as string[]);
    } catch {
      setIds([]);
    }
  }, []);

  return (
    <>
      <PageHeader title="Orders and tickets" description="Every order shows payment, booking and tickets separately, because they don't always move together." />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="device-orders" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
          <h2 id="device-orders" className="text-title">
            Orders from this device
          </h2>
          {ids === null ? null : ids.length ? (
            <ul className="mt-3 divide-y divide-line">
              {ids.map((id) => (
                <li key={id}>
                  <Link href={`/orders/${encodeURIComponent(id)}`} className="flex items-center justify-between py-3 no-underline hover:underline">
                    <span className="tnum font-mono text-body-sm">{id}</span>
                    <Icon name="chevron-right" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              <p className="text-body text-text-muted">
                No orders yet. Booking opens once sellers and payments are connected. Until then, Wayward won&apos;t
                show an order that doesn&apos;t exist.
              </p>
              <p className="mt-4 flex flex-wrap items-center gap-2 text-body-sm">
                <Link href="/orders/sample?sample=confirmed" className="font-semibold underline">
                  See what an order will look like
                </Link>
                <SampleDataBadge />
              </p>
            </div>
          )}
        </section>
        <form
          aria-labelledby="lookup-title"
          className="rounded-lg border border-line bg-surface p-4 sm:p-6"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const v = ref.trim();
            if (!v) return setError("Enter the order reference from your confirmation.");
            router.push(`/orders/${encodeURIComponent(v)}`);
          }}
        >
          <h2 id="lookup-title" className="text-title">
            Find an order
          </h2>
          <p className="mt-1 text-body-sm text-text-muted">Order lookup isn&apos;t connected yet. You&apos;ll see an honest status page, not a guess.</p>
          <label htmlFor="order-ref" className="mt-3 mb-2 block text-label">
            Order reference
          </label>
          <input
            id="order-ref"
            value={ref}
            onChange={(e) => {
              setRef(e.target.value);
              setError("");
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "order-ref-error" : undefined}
            className="h-12 w-full rounded-md border border-line-strong bg-surface px-4 font-mono"
          />
          {error ? (
            <p id="order-ref-error" className="mt-1 text-caption font-semibold text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="ghost" className="mt-4 w-full">
            Look up
          </Button>
        </form>
      </div>
    </>
  );
}
