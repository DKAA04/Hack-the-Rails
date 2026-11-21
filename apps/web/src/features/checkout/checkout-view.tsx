"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/icons";
import { Badge, Button, ButtonLink, Notice, PageHeader, cx } from "../../components/ui";
import { api } from "../../lib/api-client";
import { formatDateTime, plural } from "../../lib/format";
import { toErrorView, type ErrorView } from "../common/mappers/errors";
import type { JourneyView } from "../comparison/mappers/journey";
import { newKey } from "../search/mappers/intent";
import { readLastSearch } from "../search/rerun";
import { tripTotal } from "../trip/conflicts";
import { useTrip } from "../trip/store";
import {
  toCreateOrderRequest,
  toQuoteView,
  validateTravellers,
  type ContactDraft,
  type QuoteView,
  type TravellerDraft,
} from "./mappers/order";
import { PaymentSlot, type PaymentSlotState } from "./payment-slot";

export const LOCAL_ORDERS_KEY = "wayward.orders.v1";

type Phase =
  | { kind: "form" }
  | { kind: "checking" }
  | { kind: "quote"; quote: QuoteView }
  | { kind: "ordering"; quote: QuoteView }
  | { kind: "blocked"; error: ErrorView; step: "revalidate" | "order" | "payment" };

export function CheckoutView() {
  const router = useRouter();
  const trip = useTrip();
  const bookable = useMemo(() => trip.items.filter((j) => j.bookable), [trip.items]);
  const planOnly = trip.items.length - bookable.length;
  const searches = new Set(bookable.map((j) => j.searchId));
  const [travellers, setTravellers] = useState<TravellerDraft[]>([]);
  const [contact, setContact] = useState<ContactDraft>({ email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [accepted, setAccepted] = useState(false);
  const [payment, setPayment] = useState<PaymentSlotState>({ kind: "waiting" });
  const idempotencyKey = useRef(newKey());
  const summaryRef = useRef<HTMLDivElement>(null);
  const travelDate = bookable[0]?.departureUtc.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const last = readLastSearch();
    const ps = last?.passengers?.length ? last.passengers : [{ key: newKey(), age: "", discounts: [] }];
    setTravellers(
      ps.map((p) => ({
        key: p.key,
        givenName: "",
        familyName: "",
        dateOfBirth: "",
        age: p.age === "" ? null : Number(p.age),
        discounts: p.discounts.map((d) => ({ scheme: d.scheme, cardReference: d.cardReference })),
      })),
    );
  }, []);

  if (!trip.ready) return <PageHeader title="Checkout" />;

  if (!bookable.length)
    return (
      <>
        <PageHeader title="Checkout" />
        <div className="rounded-lg border border-dashed border-line-strong bg-surface p-6 md:p-10">
          <h2 className="font-display text-title-lg">Nothing to book yet</h2>
          <p className="mt-2 max-w-[60ch] text-text-muted">
            {trip.items.length
              ? "Every journey in your trip is a timetable result or doesn't have a live, complete price. You can plan with them, but no seller has offered seats we can book."
              : "Your trip is empty. Add a journey with a live price first."}
          </p>
          <div className="mt-6 flex gap-3">
            <ButtonLink href="/trip" variant="ghost" icon="route">
              Back to trip
            </ButtonLink>
            <ButtonLink href="/" icon="search">
              Find journeys
            </ButtonLink>
          </div>
        </div>
      </>
    );

  const total = tripTotal(bookable);
  const fieldOrder = Object.keys(errors);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateTravellers(travellers, contact, travelDate);
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (searches.size > 1) {
      setPhase({
        kind: "blocked",
        step: "revalidate",
        error: {
          kind: "conflict",
          title: "These offers come from different searches",
          message: "We can only recheck offers from one search at a time today. Book them separately, or search the whole route again.",
          retryable: false,
          requestId: null,
          code: null,
        },
      });
      return;
    }
    setPhase({ kind: "checking" });
    try {
      const r = await api.revalidate({ searchId: bookable[0]!.searchId, offerIds: bookable.map((j) => j.offerId!) });
      const quote = toQuoteView(r, bookable[0]!.searchId);
      setAccepted(false);
      setPhase({ kind: "quote", quote });
    } catch (err) {
      setPhase({ kind: "blocked", step: "revalidate", error: toErrorView(err) });
    }
  }

  async function placeOrder(quote: QuoteView) {
    setPhase({ kind: "ordering", quote });
    try {
      const order = await api.createOrder(
        toCreateOrderRequest(quote.quoteId, idempotencyKey.current, travellers, contact, travelDate),
      );
      try {
        const ids = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) ?? "[]") as string[];
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([order.id, ...ids.filter((x) => x !== order.id)]));
      } catch {
        /* storage blocked */
      }
      try {
        const session = await api.checkout({ orderId: order.id, idempotencyKey: idempotencyKey.current });
        setPayment({ kind: "redirect", url: session.redirectUrl });
      } catch (err) {
        setPayment({ kind: "unavailable", error: toErrorView(err) });
        router.push(`/orders/${encodeURIComponent(order.id)}`);
      }
    } catch (err) {
      setPhase({ kind: "blocked", step: "order", error: toErrorView(err) });
      setPayment({ kind: "unavailable", error: toErrorView(err) });
    }
  }

  const busy = phase.kind === "checking" || phase.kind === "ordering";

  return (
    <>
      <PageHeader title="Checkout" description="We recheck every price with the seller before anything is booked or charged." />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-8">
          <section aria-labelledby="review-title" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
            <h2 id="review-title" className="text-title">
              1. What you&apos;re booking
            </h2>
            <ul className="mt-4 divide-y divide-line">
              {bookable.map((j) => (
                <ReviewRow key={j.id} j={j} />
              ))}
            </ul>
            {planOnly ? (
              <p className="mt-3 text-body-sm text-text-muted">
                {plural(planOnly, "other journey")} in your trip can&apos;t be booked here and stay in your plan.
              </p>
            ) : null}
          </section>

          <form noValidate onSubmit={submit} aria-labelledby="travellers-title" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
            <h2 id="travellers-title" className="text-title">
              2. Who&apos;s travelling
            </h2>
            <p className="mt-1 text-body-sm text-text-muted">Names exactly as on the passport or ID card used for travel.</p>
            {fieldOrder.length ? (
              <div ref={summaryRef} tabIndex={-1} role="alert" className="mt-4 rounded-md border border-danger bg-danger-wash p-4 outline-none">
                <p className="font-semibold text-danger">
                  {fieldOrder.length === 1 ? "One thing to fix" : `${fieldOrder.length} things to fix`}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6 text-body-sm">
                  {fieldOrder.map((k) => (
                    <li key={k}>
                      <a href={`#${k}`} className="underline">
                        {errors[k]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <fieldset disabled={busy} className="mt-4 space-y-6">
              {travellers.map((t, i) => (
                <fieldset key={t.key} className="rounded-md border border-line p-4">
                  <legend className="px-1 text-label">
                    Traveller {i + 1}
                    {t.age !== null ? <span className="font-normal text-text-muted"> · age {t.age} in your search</span> : null}
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id={`t${i}-given`} label="First and middle names" autoComplete={i === 0 ? "given-name" : "off"} value={t.givenName} error={errors[`t${i}-given`]} onChange={(v) => setTravellers((ts) => ts.map((x, k) => (k === i ? { ...x, givenName: v } : x)))} />
                    <Field id={`t${i}-family`} label="Surname" autoComplete={i === 0 ? "family-name" : "off"} value={t.familyName} error={errors[`t${i}-family`]} onChange={(v) => setTravellers((ts) => ts.map((x, k) => (k === i ? { ...x, familyName: v } : x)))} />
                    <Field id={`t${i}-dob`} label="Date of birth" type="date" autoComplete={i === 0 ? "bday" : "off"} value={t.dateOfBirth} error={errors[`t${i}-dob`]} onChange={(v) => setTravellers((ts) => ts.map((x, k) => (k === i ? { ...x, dateOfBirth: v } : x)))} />
                  </div>
                  {t.discounts.length ? (
                    <p className="mt-3 text-body-sm text-text-muted">
                      Discount: {t.discounts.map((d) => d.scheme).join(", ")}. Bring the card when you travel.
                    </p>
                  ) : null}
                </fieldset>
              ))}
              <fieldset className="rounded-md border border-line p-4">
                <legend className="px-1 text-label">Contact</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="email" label="Email" type="email" autoComplete="email" value={contact.email} error={errors.email} hint="Tickets and changes go here." onChange={(v) => setContact((c) => ({ ...c, email: v }))} />
                  <Field id="phone" label="Mobile (optional)" type="tel" autoComplete="tel" value={contact.phone} error={errors.phone} hint="For disruption alerts from sellers." onChange={(v) => setContact((c) => ({ ...c, phone: v }))} />
                </div>
              </fieldset>
            </fieldset>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption text-text-muted">Next we ask the seller to confirm price and seats. Nothing is charged at this step.</p>
              <Button type="submit" loading={phase.kind === "checking"} disabled={busy} iconAfter="arrow-right">
                {phase.kind === "checking" ? "Checking with seller…" : "Check price and seats"}
              </Button>
            </div>
          </form>

          <div aria-live="polite">
            {phase.kind === "blocked" ? (
              <Notice
                tone={phase.error.kind === "not_implemented" ? "info" : "danger"}
                role="alert"
                title={
                  phase.error.kind === "not_implemented"
                    ? phase.step === "revalidate"
                      ? "Rechecking prices isn't available yet"
                      : "Booking isn't available yet"
                    : phase.error.title
                }
                action={
                  phase.error.retryable ? (
                    <Button variant="ghost" size="sm" icon="refresh" onClick={() => setPhase({ kind: "form" })}>
                      Try again
                    </Button>
                  ) : null
                }
              >
                {phase.error.kind === "not_implemented"
                  ? "Wayward can't place this order yet, so nothing was booked or charged. Your trip and details are still here."
                  : phase.error.message}
                {phase.error.requestId && phase.error.kind !== "not_implemented" ? <span className="mt-1 block text-caption">Support code {phase.error.requestId}</span> : null}
              </Notice>
            ) : null}
            {phase.kind === "quote" || phase.kind === "ordering" ? (
              <QuotePanel
                quote={phase.quote}
                accepted={accepted}
                onAccept={setAccepted}
                busy={phase.kind === "ordering"}
                onContinue={() => placeOrder(phase.quote)}
              />
            ) : null}
          </div>

          <section aria-labelledby="payment-title" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
            <h2 id="payment-title" className="text-title">
              3. Payment
            </h2>
            <PaymentSlot state={payment} />
          </section>
        </div>

        <aside aria-label="Order summary" className="on-ink rounded-lg bg-ink p-6 text-white lg:sticky lg:top-24">
          <h2 className="text-title">To pay</h2>
          <p className="tnum mt-2 font-display text-headline">{total.knownDisplay}</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            {total.complete ? "Searched price. Confirmed with the seller before payment." : "Not a complete total yet."}
          </p>
          <ul className="mt-4 space-y-2 border-t border-ink-line pt-4 text-body-sm">
            {bookable.map((j) => (
              <li key={j.id} className="flex justify-between gap-3">
                <span className="truncate text-ink-muted">
                  {j.origin.name} → {j.destination.name}
                </span>
                <span className="tnum shrink-0">{j.price.display}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-caption text-ink-muted">A payment is not a ticket. Tickets appear once each seller issues them.</p>
        </aside>
      </div>
    </>
  );
}

function ReviewRow({ j }: { j: JourneyView }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="tnum font-semibold">
          {j.departureLocal}–{j.arrivalLocal} · {j.origin.name} → {j.destination.name}
        </p>
        <p className="text-body-sm text-text-muted">
          {j.dateLabel} · Sold by {j.seller?.name ?? "unknown seller"}
          {j.freshness?.expiresAt ? ` · offer expires ${formatDateTime(j.freshness.expiresAt)}` : ""}
        </p>
      </div>
      <span className="flex items-center gap-2">
        <span className="tnum font-semibold">{j.price.display}</span>
        <Badge tone={j.price.kindTone}>{j.price.kindLabel}</Badge>
      </span>
    </li>
  );
}

function QuotePanel({
  quote,
  accepted,
  onAccept,
  busy,
  onContinue,
}: {
  quote: QuoteView;
  accepted: boolean;
  onAccept: (v: boolean) => void;
  busy: boolean;
  onContinue: () => void;
}) {
  const canContinue = quote.status !== "unavailable" && (!quote.requiresAcceptance || accepted);
  return (
    <Notice tone={quote.tone} title={quote.statusLabel} role="status">
      <p>{quote.message}</p>
      <ul className="mt-2 space-y-1">
        {quote.journeys.map((j) => (
          <li key={j.id} className="tnum">
            {j.departureLocal}–{j.arrivalLocal} {j.origin.name} → {j.destination.name}: <strong className="text-ink">{j.price.display}</strong> ({j.price.kindLabel})
          </li>
        ))}
      </ul>
      <p className="mt-2 text-caption">Held at this price until {formatDateTime(quote.expiresAt)}. Not a seat reservation.</p>
      {quote.requiresAcceptance && quote.status !== "unavailable" ? (
        <label className="mt-3 flex items-start gap-2 text-ink">
          <input type="checkbox" checked={accepted} onChange={(e) => onAccept(e.target.checked)} className="mt-1 size-4 accent-ink" />
          I&apos;ve checked the changes and want to continue at the new price and times.
        </label>
      ) : null}
      {quote.status !== "unavailable" ? (
        <Button className="mt-4" onClick={onContinue} disabled={!canContinue || busy} loading={busy} iconAfter="arrow-right">
          Place order
        </Button>
      ) : (
        <ButtonLink href="/" className="mt-4" icon="search">
          Search again
        </ButtonLink>
      )}
    </Notice>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx("h-12 w-full rounded-md border bg-surface px-4 focus:border-ink", error ? "border-danger" : "border-line-strong")}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-caption text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 flex items-start gap-1 text-caption font-semibold text-danger">
          <Icon name="alert" size={14} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
