import { Icon, type IconName } from "../../components/icons";
import { Badge, cx, type Tone } from "../../components/ui";
import { formatDateTime, formatMoney } from "../../lib/format";
import { JourneyTimeline } from "./journey-timeline";
import type { Aftersale, JourneyView, PriceView } from "./mappers/journey";

export function PriceBreakdown({ price, isOffer }: { price: PriceView; isOffer: boolean }) {
  return (
    <section aria-label="Price breakdown">
      <h4 className="text-label">Price</h4>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={price.kindTone}>{price.kindLabel}</Badge>
        {price.completeness === "partial" ? <Badge tone="warn">Partial total</Badge> : null}
      </p>
      <p className="mt-2 text-body-sm text-text-muted">{price.kindExplanation}</p>
      {price.breakdown.length ? (
        <dl className="mt-3 divide-y divide-line text-body-sm">
          {price.breakdown.map((b, i) => (
            <div key={`${b.label}-${i}`} className="flex justify-between gap-4 py-2">
              <dt>
                {b.categoryLabel}
                {b.label && b.label !== b.categoryLabel ? (
                  <span className="text-text-muted"> · {b.label}</span>
                ) : null}
              </dt>
              <dd className="tnum">{b.display}</dd>
            </div>
          ))}
          {isOffer && price.total ? (
            <div className="flex justify-between gap-4 py-2">
              <dt>Wayward fee</dt>
              <dd className="tnum">{formatMoney({ amount: 0, currency: price.total.currency })}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 py-2 font-bold">
            <dt>{price.completeness === "partial" ? "Known total" : "Total"}</dt>
            <dd className="tnum">{price.display}</dd>
          </div>
        </dl>
      ) : price.total ? (
        <p className="mt-3 flex justify-between font-bold">
          <span>Total</span>
          <span className="tnum">{price.display}</span>
        </p>
      ) : price.kind === "published_tariff_range" ? (
        <p className="mt-3 font-bold tnum">{price.display}</p>
      ) : null}
      {price.total && !price.breakdown.length ? (
        <p className="mt-1 text-caption text-text-muted">The seller didn&apos;t itemise this price.</p>
      ) : null}
      {price.missingComponents.length ? (
        <p className="mt-2 text-body-sm text-warn">
          Not included yet: {price.missingComponents.join(", ")}.
        </p>
      ) : null}
      {price.observedAt ? (
        <p className="mt-2 text-caption text-text-muted">Priced {formatDateTime(price.observedAt)}</p>
      ) : null}
    </section>
  );
}

const AFTERSALE: Record<Aftersale, { icon: IconName; tone: string; label: string }> = {
  supported: { icon: "check", tone: "text-ok", label: "Allowed" },
  unsupported: { icon: "close", tone: "text-danger", label: "Not allowed" },
  unknown: { icon: "info", tone: "text-text-muted", label: "Unknown" },
};

function bagText(n: number | null) {
  if (n === null) return "Unknown";
  if (n === 0) return "Not included";
  return `${n} included`;
}

export function FareConditions({ journey }: { journey: JourneyView }) {
  const c = journey.conditions;
  if (!c)
    return (
      <section aria-label="Fare conditions">
        <h4 className="text-label">Conditions and seller</h4>
        <p className="mt-2 text-body-sm text-text-muted">
          No seller yet. This journey comes from {journey.attribution ?? journey.providerLabel}, which publishes
          timetables, not fares. Refunds, changes and baggage depend on whoever eventually sells the ticket.
        </p>
      </section>
    );
  const rows: [string, Aftersale][] = [
    ["Refund", c.refund],
    ["Change", c.exchange],
    ["Cancel", c.cancellation],
  ];
  return (
    <section aria-label="Fare conditions">
      <h4 className="text-label">Conditions</h4>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-body-sm">
        {rows.map(([label, v]) => (
          <div key={label} className="rounded-md bg-paper p-2">
            <dt className="text-caption text-text-muted">{label}</dt>
            <dd className={cx("mt-0.5 flex items-center gap-1 font-semibold", AFTERSALE[v].tone)}>
              <Icon name={AFTERSALE[v].icon} size={14} />
              {AFTERSALE[v].label}
            </dd>
          </div>
        ))}
      </dl>
      {c.summary ? <p className="mt-2 text-body-sm">{c.summary}</p> : null}
      {c.termsUrl ? (
        <a href={c.termsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-body-sm underline">
          Full fare rules <Icon name="external" size={14} />
        </a>
      ) : null}
      <dl className="mt-3 divide-y divide-line text-body-sm">
        <div className="flex justify-between py-2">
          <dt>Cabin bag</dt>
          <dd>{bagText(journey.baggage.cabin)}</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt>Checked bag</dt>
          <dd>{bagText(journey.baggage.checked)}</dd>
        </div>
        {journey.includedServices
          .filter((s) => s.kind !== "cabin_bag" && s.kind !== "checked_bag")
          .map((s, i) => (
            <div key={i} className="flex justify-between gap-4 py-2">
              <dt className="capitalize">{s.kind}</dt>
              <dd className="text-right">{s.description}</dd>
            </div>
          ))}
      </dl>
      {journey.baggage.cabin === null || journey.baggage.checked === null ? (
        <p className="mt-1 text-caption text-text-muted">Unknown means the seller didn&apos;t say. Don&apos;t assume it&apos;s included.</p>
      ) : null}
    </section>
  );
}

export function SellerDetails({ journey }: { journey: JourneyView }) {
  if (!journey.seller) return null;
  const mor = journey.seller.merchantOfRecord;
  const fresh = journey.freshness;
  const freshTone: Record<string, Tone> = { fresh: "ok", stale: "warn", expired: "danger", unknown: "neutral" };
  return (
    <section aria-label="Seller">
      <h4 className="text-label">Seller</h4>
      <dl className="mt-2 divide-y divide-line text-body-sm">
        <div className="flex justify-between gap-4 py-2">
          <dt>Sold by</dt>
          <dd className="font-semibold">{journey.seller.name}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt>Charges your card</dt>
          <dd>{mor === null ? "Unknown" : mor ? journey.seller.name : "Not the seller"}</dd>
        </div>
        <div className="flex justify-between gap-4 py-2">
          <dt>Found via</dt>
          <dd>{journey.providerLabel}</dd>
        </div>
        {fresh ? (
          <div className="flex items-center justify-between gap-4 py-2">
            <dt>Price checked</dt>
            <dd className="flex items-center gap-2">
              <span className="tnum">{formatDateTime(fresh.fetchedAt)}</span>
              <Badge tone={freshTone[fresh.state] ?? "neutral"}>{fresh.state}</Badge>
            </dd>
          </div>
        ) : null}
        {fresh?.expiresAt ? (
          <div className="flex justify-between gap-4 py-2">
            <dt>Offer expires</dt>
            <dd className="tnum">{formatDateTime(fresh.expiresAt)}</dd>
          </div>
        ) : null}
        {journey.environment === "test" ? (
          <div className="py-2 text-warn">Supplier test environment. Not real inventory.</div>
        ) : null}
      </dl>
    </section>
  );
}

export function JourneyDetails({ journey }: { journey: JourneyView }) {
  return (
    <div className="grid gap-8 border-t border-line pt-6 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <h4 className="mb-3 text-label">Timeline</h4>
        <JourneyTimeline journey={journey} />
      </div>
      <div className="space-y-6">
        <PriceBreakdown price={journey.price} isOffer={journey.source === "offer"} />
        <FareConditions journey={journey} />
        <SellerDetails journey={journey} />
        {journey.attribution ? (
          <p className="text-caption text-text-muted">Source: {journey.attribution}</p>
        ) : null}
      </div>
    </div>
  );
}
