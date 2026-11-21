"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/icons";
import { Badge, Button, ButtonLink, Notice, PageHeader, cx } from "../../components/ui";
import { api } from "../../lib/api-client";
import { readDateField } from "../../lib/dom-date";
import { formatDateTime, plural } from "../../lib/format";
import { toErrorView, toPendingEndpointErrorView, type ErrorView } from "../common/mappers/errors";
import type { JourneyView } from "../comparison/mappers/journey";
import { OrderStatus } from "../account/order-status";
import { OrderWorkflowPanel } from "../account/order-workflow";
import { useOrder } from "../account/use-order";
import { lastSearchFor } from "../search/rerun";
import { stillBookable, tripTotal } from "../trip/conflicts";
import { useTrip } from "../trip/store";
import {
  DOCUMENT_LABEL,
  TITLES,
  documentPolicy,
  toCreateOrderRequest,
  toOrderView,
  toQuoteView,
  toUpdateTravellersRequest,
  validateTravellers,
  type ContactDraft,
  type DocumentPolicy,
  type NextAction,
  type OrderView,
  type QuoteView,
  type TravellerDraft,
} from "./mappers/order";
import { idempotencyKeyFor } from "./idempotency";
import { PaymentSlot, type PaymentSlotState } from "./payment-slot";

export const LOCAL_ORDERS_KEY = "wayward.orders.v1";

type Phase =
  | { kind: "form" }
  | { kind: "checking" }
  | { kind: "quote"; quote: QuoteView }
  | { kind: "ordering"; quote: QuoteView }
  | { kind: "order"; order: OrderView }
  | { kind: "blocked"; error: ErrorView; step: "revalidate" | "order" };

const emptyDoc = { type: "" as const, number: "", issuingCountry: "", expiresOn: "" };

export function CheckoutView() {
  const trip = useTrip();
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const inOrder = phase.kind === "order";
  // Journeys already ordered from this browser aren't offered for booking
  // again (but stay listed while this checkout shows the order it created).
  const bookable = useMemo(
    () => trip.items.filter((j) => (inOrder || (stillBookable(j) && !trip.ordered[j.id])) && j.bookable),
    [trip.items, trip.ordered, inOrder],
  );
  const planOnly = trip.items.length - bookable.length;
  const searchIds = useMemo(() => [...new Set(bookable.map((j) => j.searchId))], [bookable]);
  const policy = useMemo(() => documentPolicy(bookable), [bookable]);
  // Traveller details live only in this component's memory: never in URLs,
  // logs, localStorage or sessionStorage.
  const [travellers, setTravellers] = useState<TravellerDraft[] | null>(null);
  const [contact, setContact] = useState<ContactDraft>({ email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  useEffect(() => {
    if (failedSubmits) summaryRef.current?.focus();
  }, [failedSubmits]);
  const travelDate = bookable[0]?.departureUtc.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!trip.ready || travellers !== null || searchIds.length !== 1) return;
    const last = lastSearchFor(searchIds[0]!);
    if (!last) {
      setTravellers([]);
      return;
    }
    setTravellers(
      last.passengers.map((p) => ({
        passengerId: p.key,
        age: p.age === "" ? null : Number(p.age),
        title: "",
        gender: "",
        givenName: "",
        familyName: "",
        bornOn: "",
        document: { ...emptyDoc },
        discounts: p.discounts.map((d) => ({ scheme: d.scheme, cardReference: d.cardReference })),
      })),
    );
  }, [trip.ready, travellers, searchIds]);

  if (!trip.ready) return <PageHeader title="Checkout" />;

  const alreadyOrdered = trip.items.filter((j) => trip.ordered[j.id]);
  if (!bookable.length && alreadyOrdered.length && phase.kind !== "order")
    return (
      <>
        <PageHeader title="Checkout" />
        <div className="rounded-lg border border-dashed border-line-strong bg-surface p-6 md:p-10">
          <h2 className="font-display text-title-lg">Already ordered</h2>
          <p className="mt-2 max-w-[60ch] text-text-muted">
            The bookable {alreadyOrdered.length === 1 ? "journey" : "journeys"} in your trip already {alreadyOrdered.length === 1 ? "has an order" : "have orders"}. Check
            the status there rather than booking again.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {[...new Set(alreadyOrdered.map((j) => trip.ordered[j.id]!))].map((id) => (
              <ButtonLink key={id} href={`/orders/${encodeURIComponent(id)}`} icon="ticket">
                View order
              </ButtonLink>
            ))}
            <ButtonLink href="/" variant="ghost" icon="search">
              Find journeys
            </ButtonLink>
          </div>
        </div>
      </>
    );

  if (!bookable.length && phase.kind !== "order")
    return (
      <>
        <PageHeader title="Checkout" />
        <Blocked
          title="Nothing to book yet"
          body={
            trip.items.length
              ? "Every journey in your trip is a timetable result or doesn't have a live, complete price. You can plan with them, but no seller has offered seats we can book."
              : "Your trip is empty. Add a journey with a live price first."
          }
        />
      </>
    );

  if (searchIds.length > 1)
    return (
      <>
        <PageHeader title="Checkout" />
        <Blocked
          title="These offers come from different searches"
          body="We can only check and book offers from one search at a time today. Remove the others from your trip, or search the whole route again."
        />
      </>
    );

  if (travellers !== null && travellers.length === 0)
    return (
      <>
        <PageHeader title="Checkout" />
        <Blocked
          title="Search again before booking"
          body="We can't match travellers to the search these offers came from (it was started in another tab, or this browser session ended). Search again so the seller gets the right passengers."
        />
      </>
    );

  const total = tripTotal(bookable);
  const errorKeys = Object.keys(errors);
  const formLocked = phase.kind !== "form" && phase.kind !== "blocked";

  function setT(i: number, patch: Partial<TravellerDraft>) {
    setTravellers((ts) => (ts ?? []).map((x, k) => (k === i ? { ...x, ...patch } : x)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!travellers) return;
    // Adopt dates the fields hold but React never heard about (autofill etc.).
    const synced = travellers.map((t, i) => ({
      ...t,
      bornOn: t.bornOn || readDateField(`t${i}-dob`).value,
      document: { ...t.document, expiresOn: t.document.expiresOn || readDateField(`t${i}-docexp`).value },
    }));
    if (synced.some((t, i) => t.bornOn !== travellers[i]!.bornOn || t.document.expiresOn !== travellers[i]!.document.expiresOn))
      setTravellers(synced);
    const errs = validateTravellers(synced, contact, travelDate, policy);
    synced.forEach((t, i) => {
      if (errs[`t${i}-dob`] && !t.bornOn && readDateField(`t${i}-dob`).incomplete)
        errs[`t${i}-dob`] = `Traveller ${i + 1}: that date of birth isn't complete. Check the day, month and year.`;
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFailedSubmits((n) => n + 1);
      return;
    }
    setPhase({ kind: "checking" });
    try {
      const r = await api.revalidate({ searchId: searchIds[0]!, offerIds: bookable.map((j) => j.offerId!) });
      setAccepted(false);
      setPhase({ kind: "quote", quote: toQuoteView(r, searchIds[0]!) });
    } catch (err) {
      setPhase({ kind: "blocked", step: "revalidate", error: toErrorView(err) });
    }
  }

  async function placeOrder(quote: QuoteView) {
    if (!travellers) return;
    setPhase({ kind: "ordering", quote });
    try {
      const order = await api.createOrder(
        toCreateOrderRequest({
          quoteId: quote.quoteId,
          // Same quote = same logical order: retries reuse the key.
          idempotencyKey: idempotencyKeyFor("create", quote.quoteId),
          travellers,
          contact,
          travelDateIso: travelDate,
          policy,
          acceptChanges: quote.requiresAcceptance && accepted,
        }),
      );
      try {
        // Only the opaque order ID is kept; never traveller details.
        const ids = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) ?? "[]") as string[];
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([order.id, ...ids.filter((x) => x !== order.id)]));
      } catch {
        /* storage blocked */
      }
      trip.markOrdered(
        bookable.map((j) => j.id),
        order.id,
      );
      setPhase({ kind: "order", order: toOrderView(order) });
    } catch (err) {
      setPhase({ kind: "blocked", step: "order", error: toErrorView(err) });
    }
  }

  return (
    <>
      <PageHeader title="Checkout" description="We recheck every price with the seller before anything is reserved or charged." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="review-title" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
            <h2 id="review-title" className="text-title">
              1. What you&apos;re booking
            </h2>
            <ul className="mt-4 divide-y divide-line">
              {bookable.map((j) => (
                <ReviewRow key={j.id} j={j} />
              ))}
            </ul>
            {bookable.some((j) => j.testInventory) ? (
              <Notice tone="warn" title="Test booking" className="mt-4">
                {bookable.every((j) => j.testInventory)
                  ? "These are the seller's sandbox offers. Booking runs end to end in test mode with Stripe test payments: no real ticket is issued and no real money moves."
                  : "Some offers are sandbox test inventory and some are live. Test and live offers can't be booked together."}
              </Notice>
            ) : null}
            {planOnly ? (
              <p className="mt-3 text-body-sm text-text-muted">
                {plural(planOnly, "other journey")} in your trip can&apos;t be booked here and stay in your plan.
              </p>
            ) : null}
          </section>

          {phase.kind === "order" ? (
            <CheckoutOrder
              initial={phase.order}
              travellers={travellers ?? []}
              contact={contact}
              policy={policy}
              onRecheck={() => setPhase({ kind: "form" })}
            />
          ) : (
            <>
              <form noValidate onSubmit={submit} aria-labelledby="travellers-title" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
                <h2 id="travellers-title" tabIndex={-1} className="text-title outline-none">
                  2. Who&apos;s travelling
                </h2>
                <p className="mt-1 text-body-sm text-text-muted">
                  Exactly as on the passport or ID card used for travel. Every field is required. These details stay on this
                  page only: they&apos;re not saved in your browser.
                </p>
                {errorKeys.length ? (
                  <div ref={summaryRef} tabIndex={-1} role="alert" className="mt-4 rounded-md border border-danger bg-danger-wash p-4 outline-none">
                    <p className="font-semibold text-danger">
                      {errorKeys.length === 1 ? "One thing to fix" : `${errorKeys.length} things to fix`}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-6 text-body-sm">
                      {errorKeys.map((k) => (
                        <li key={k}>
                          <a href={`#${k}`} className="inline-block py-1 underline">
                            {errors[k]}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {policy.required ? (
                  <Notice tone="info" title="This seller needs an ID document for each traveller" className="mt-4">
                    {policy.accepted.length
                      ? `Accepted: ${policy.accepted.map((d) => (d === "passport" ? "passport" : "national ID card")).join(" or ")}.`
                      : "The seller didn't say which documents it accepts."}{" "}
                    Document numbers go only to the seller with your booking.
                  </Notice>
                ) : null}
                <fieldset disabled={formLocked} className="mt-4 space-y-6">
                  {(travellers ?? []).map((t, i) => (
                    <TravellerFields key={t.passengerId} i={i} t={t} errors={errors} policy={policy} onChange={(p) => setT(i, p)} />
                  ))}
                  <fieldset className="rounded-md border border-line p-4">
                    <legend className="px-1 text-label">Contact</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id="email" label="Email" type="email" autoComplete="email" value={contact.email} error={errors.email} hint="Tickets and changes go here." onChange={(v) => setContact((c) => ({ ...c, email: v }))} />
                      <Field id="phone" label="Mobile number" type="tel" autoComplete="tel" value={contact.phone} error={errors.phone} hint="With country code, e.g. +49 30 1234567. For disruption alerts." onChange={(v) => setContact((c) => ({ ...c, phone: v }))} />
                    </div>
                  </fieldset>
                </fieldset>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" hidden={phase.kind === "quote" || phase.kind === "ordering"}>
                  <p className="text-caption text-text-muted">
                    <span className="tnum font-semibold text-ink lg:hidden">Total {total.knownDisplay}. </span>
                    Next we ask the seller to confirm price and seats. Nothing is charged at this step.
                  </p>
                  <Button type="submit" loading={phase.kind === "checking"} disabled={formLocked} iconAfter="arrow-right">
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
                      ? "Wayward can't place this order yet, so nothing was reserved or charged. Your trip and the details on this page are still here."
                      : phase.error.message}
                    {phase.error.requestId && phase.error.kind === "unknown" ? (
                      <span className="mt-1 block text-caption">Support code {phase.error.requestId}</span>
                    ) : null}
                  </Notice>
                ) : null}
                {phase.kind === "quote" || phase.kind === "ordering" ? (
                  <QuotePanel
                    quote={phase.quote}
                    accepted={accepted}
                    onAccept={setAccepted}
                    busy={phase.kind === "ordering"}
                    onContinue={() => placeOrder(phase.quote)}
                    onChangeDetails={() => {
                      setPhase({ kind: "form" });
                      window.setTimeout(() => document.getElementById("travellers-title")?.focus(), 0);
                    }}
                  />
                ) : null}
              </div>

              <section aria-labelledby="payment-title" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
                <h2 id="payment-title" className="text-title">
                  3. Payment
                </h2>
                <PaymentSlot state={{ kind: "waiting" }} />
              </section>
            </>
          )}
        </div>

        <aside aria-label="Order summary" className="on-ink rounded-lg bg-ink p-6 text-white lg:sticky lg:top-24">
          <h2 className="text-title">Total</h2>
          <p className="tnum mt-2 font-display text-headline">{total.knownDisplay}</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            {total.complete ? "Searched price. Confirmed with the seller before payment." : "Not a complete total yet."}
          </p>
          <ul className="mt-4 space-y-2 border-t border-ink-line pt-4 text-body-sm">
            {bookable.map((j) => (
              <li key={j.id} className="flex justify-between gap-3">
                <span className="min-w-0 break-words text-ink-muted">
                  {j.departureLocal} {j.origin.name} → {j.destination.name}
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

/** After order creation: workflow, next actions, polling, payment slot. */
function CheckoutOrder({
  initial,
  travellers,
  contact,
  policy,
  onRecheck,
}: {
  initial: OrderView;
  travellers: TravellerDraft[];
  contact: ContactDraft;
  policy: DocumentPolicy;
  onRecheck: () => void;
}) {
  const { load, setOrder, polling, pollMs, lastChecked, syncing, syncError, reconcile } = useOrder(initial.id, initial);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ErrorView | null>(null);
  const [payment, setPayment] = useState<PaymentSlotState>({ kind: "waiting" });
  const order = load.status === "ready" ? load.order : initial;

  async function onAction(a: NextAction) {
    setBusy(true);
    setActionError(null);
    try {
      if (a === "provide_travellers")
        setOrder(toOrderView(await api.updateTravellers(order.id, toUpdateTravellersRequest(travellers, contact, policy))));
      else if (a === "reserve")
        setOrder(toOrderView(await api.reserve(order.id, { idempotencyKey: idempotencyKeyFor("reserve", order.id) })));
      else if (a === "checkout") {
        const s = await api.checkout({ orderId: order.id, idempotencyKey: idempotencyKeyFor("checkout", order.id) });
        setPayment({ kind: "redirect", url: s.redirectUrl });
        window.location.assign(s.redirectUrl);
      } else if (a === "accept_changes") onRecheck();
    } catch (e) {
      const err = a === "checkout" ? toErrorView(e) : toPendingEndpointErrorView(e);
      setActionError(err);
      if (a === "checkout") setPayment({ kind: "unavailable", error: err });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <OrderWorkflowPanel
        order={order}
        onAction={onAction}
        busy={busy}
        actionError={actionError}
        polling={polling}
        pollMs={pollMs}
        lastChecked={lastChecked}
        syncing={syncing}
        syncError={syncError}
        onCheckAgain={() => void reconcile()}
      />
      {payment.kind !== "waiting" ? (
        <section aria-labelledby="payment-title" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
          <h2 id="payment-title" className="text-title">
            Payment
          </h2>
          <PaymentSlot state={payment} />
        </section>
      ) : null}
      <OrderStatus order={order} />
    </>
  );
}

function Blocked({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface p-6 md:p-10">
      <h2 className="font-display text-title-lg">{title}</h2>
      <p className="mt-2 max-w-[60ch] text-text-muted">{body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/trip" variant="ghost" icon="route">
          Back to trip
        </ButtonLink>
        <ButtonLink href="/" icon="search">
          Find journeys
        </ButtonLink>
      </div>
    </div>
  );
}

function TravellerFields({
  i,
  t,
  errors,
  policy,
  onChange,
}: {
  i: number;
  t: TravellerDraft;
  errors: Record<string, string>;
  policy: DocumentPolicy;
  onChange: (p: Partial<TravellerDraft>) => void;
}) {
  const docTypes = policy.accepted.length ? policy.accepted : (["passport", "identity_card"] as const);
  return (
    <fieldset className="rounded-md border border-line p-4">
      <legend className="px-1 text-label">
        Traveller {i + 1}
        {t.age !== null ? <span className="font-normal text-text-muted"> · age {t.age} in your search</span> : null}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`t${i}-given`} label="First and middle names" autoComplete={i === 0 ? "given-name" : "off"} value={t.givenName} error={errors[`t${i}-given`]} onChange={(v) => onChange({ givenName: v })} />
        <Field id={`t${i}-family`} label="Surname" autoComplete={i === 0 ? "family-name" : "off"} value={t.familyName} error={errors[`t${i}-family`]} onChange={(v) => onChange({ familyName: v })} />
        <SelectField id={`t${i}-title`} label="Title" value={t.title} error={errors[`t${i}-title`]} onChange={(v) => onChange({ title: v as TravellerDraft["title"] })} options={[["", "Choose"], ...TITLES.map((x) => [x.value, x.label] as [string, string])]} />
        <SelectField
          id={`t${i}-gender`}
          label="Gender on ID"
          value={t.gender}
          error={errors[`t${i}-gender`]}
          hint="The seller's system only accepts these two values."
          onChange={(v) => onChange({ gender: v as TravellerDraft["gender"] })}
          options={[
            ["", "Choose"],
            ["f", "Female"],
            ["m", "Male"],
          ]}
        />
        <Field id={`t${i}-dob`} label="Date of birth" type="date" autoComplete={i === 0 ? "bday" : "off"} value={t.bornOn} error={errors[`t${i}-dob`]} onChange={(v) => onChange({ bornOn: v })} />
      </div>
      {policy.required ? (
        <fieldset className="mt-4 rounded-md bg-paper p-3">
          <legend className="sr-only">ID document for traveller {i + 1}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id={`t${i}-doctype`}
              label="ID document"
              value={t.document.type}
              error={errors[`t${i}-doctype`]}
              onChange={(v) => onChange({ document: { ...t.document, type: v as TravellerDraft["document"]["type"] } })}
              options={[["", "Choose"], ...docTypes.map((d) => [d, DOCUMENT_LABEL[d]] as [string, string])]}
            />
            <Field id={`t${i}-docnum`} label="Document number" autoComplete="off" spellCheck={false} value={t.document.number} error={errors[`t${i}-docnum`]} onChange={(v) => onChange({ document: { ...t.document, number: v } })} />
            <Field id={`t${i}-doccountry`} label="Issuing country" autoComplete="off" maxLength={2} hint="Two letters, e.g. DE, FR, ES." value={t.document.issuingCountry} error={errors[`t${i}-doccountry`]} onChange={(v) => onChange({ document: { ...t.document, issuingCountry: v.toUpperCase() } })} />
            <Field id={`t${i}-docexp`} label="Expiry date" type="date" autoComplete="off" value={t.document.expiresOn} error={errors[`t${i}-docexp`]} onChange={(v) => onChange({ document: { ...t.document, expiresOn: v } })} />
          </div>
        </fieldset>
      ) : null}
      {t.discounts.length ? (
        <p className="mt-3 text-body-sm text-text-muted">Discount: {t.discounts.map((d) => d.scheme).join(", ")}. Bring the card when you travel.</p>
      ) : null}
    </fieldset>
  );
}

function ReviewRow({ j }: { j: JourneyView }) {
  const req = j.bookingRequirements;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="tnum font-semibold">
          {j.departureLocal}–{j.arrivalLocal} · {j.origin.name} → {j.destination.name}
        </p>
        <p className="text-body-sm text-text-muted">
          {j.dateLabel} · Sold by {j.seller?.name ?? "unknown seller"}
          {j.freshness?.expiresAt ? ` · offer expires ${formatDateTime(j.freshness.expiresAt)}` : ""}
          {req?.paymentRequiredBy ? ` · pay by ${formatDateTime(req.paymentRequiredBy)}` : ""}
          {req?.priceGuaranteeExpiresAt ? ` · price guaranteed until ${formatDateTime(req.priceGuaranteeExpiresAt)}` : ""}
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
  onChangeDetails,
}: {
  quote: QuoteView;
  accepted: boolean;
  onAccept: (v: boolean) => void;
  busy: boolean;
  onContinue: () => void;
  onChangeDetails: () => void;
}) {
  const canContinue = quote.status !== "unavailable" && (!quote.requiresAcceptance || accepted);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [quote.quoteId]);
  return (
    <div ref={ref} tabIndex={-1} aria-label={`Seller check: ${quote.statusLabel}`} className="rounded-md outline-none">
    <Notice tone={quote.tone} title={quote.statusLabel}>
      <p>{quote.message}</p>
      <ul className="mt-2 space-y-1">
        {quote.journeys.map((j) => (
          <li key={j.id} className="tnum">
            {j.departureLocal}–{j.arrivalLocal} {j.origin.name} → {j.destination.name}: <strong className="text-ink">{j.price.display}</strong> ({j.price.kindLabel})
          </li>
        ))}
      </ul>
      <p className="mt-2 text-caption">Quote valid until {formatDateTime(quote.expiresAt)}. This is not a seat reservation.</p>
      {quote.requiresAcceptance && quote.status !== "unavailable" ? (
        <label className="mt-3 flex items-start gap-2 text-ink">
          <input type="checkbox" checked={accepted} onChange={(e) => onAccept(e.target.checked)} className="mt-1 size-4 accent-ink" />
          I&apos;ve checked the changes and want to continue at the new price and times.
        </label>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {quote.status !== "unavailable" ? (
          <Button onClick={onContinue} disabled={!canContinue || busy} loading={busy} iconAfter="arrow-right">
            Create order
          </Button>
        ) : (
          <ButtonLink href="/" icon="search">
            Search again
          </ButtonLink>
        )}
        <Button variant="ghost" onClick={onChangeDetails} disabled={busy}>
          Change details
        </Button>
      </div>
      <p className="mt-2 text-caption">Changing details means we check the price with the seller again.</p>
    </Notice>
    </div>
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
  spellCheck,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  spellCheck?: boolean;
  maxLength?: number;
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
        spellCheck={spellCheck}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-required="true"
        aria-describedby={describedBy}
        className={cx("h-12 w-full rounded-md border bg-surface px-4 focus:border-ink", error ? "border-danger" : "border-line-strong")}
      />
      {hint ? (
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

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  error?: string;
  hint?: string;
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-label">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-required="true"
        aria-describedby={describedBy}
        className={cx("h-12 w-full rounded-md border bg-surface px-3 focus:border-ink", error ? "border-danger" : "border-line-strong")}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {hint ? (
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
