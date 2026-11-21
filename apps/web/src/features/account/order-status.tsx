import { Icon, type IconName } from "../../components/icons";
import { Badge, cx } from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import type { OrderView } from "../checkout/mappers/order";

const STEP_ICON: Record<string, IconName> = { pending: "clock", confirmed: "check", partial: "alert", failed: "alert", cancelled: "close", draft: "info" };

export function OrderStatus({ order }: { order: OrderView }) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-surface p-4 sm:p-6" aria-labelledby="order-state">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-caption text-text-muted">Order {order.id} · placed {formatDateTime(order.createdAt)}</p>
            <h2 id="order-state" className="mt-1 flex items-center gap-2 font-display text-title-lg">
              <Icon name={STEP_ICON[order.state] ?? "info"} size={24} className={cx(order.tone === "ok" ? "text-ok" : order.tone === "danger" ? "text-danger" : order.tone === "warn" ? "text-warn" : "text-text-muted")} />
              {order.stateLabel}
            </h2>
            <p className="mt-1 max-w-[60ch] text-body-sm text-text-muted">{order.explain}</p>
          </div>
          <div className="text-right">
            <p className="tnum font-display text-title-lg">{order.total.display}</p>
            <Badge tone={order.total.kindTone}>{order.total.kindLabel}</Badge>
          </div>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-paper p-3">
            <dt className="text-caption text-text-muted">Order</dt>
            <dd className="font-semibold">{order.stateLabel}</dd>
          </div>
          <div className="rounded-md bg-paper p-3">
            <dt className="text-caption text-text-muted">Your payment</dt>
            <dd className="font-semibold">{order.paymentLabel}</dd>
          </div>
          <div className="rounded-md bg-paper p-3">
            <dt className="text-caption text-text-muted">Tickets</dt>
            <dd className="font-semibold">{order.fulfilmentLabel}</dd>
          </div>
        </dl>
        <p className="mt-3 text-caption text-text-muted">These move independently. Paid doesn&apos;t mean ticketed, so check the tickets below before you travel.</p>
      </section>

      <section aria-labelledby="bookings-title">
        <h2 id="bookings-title" className="text-title">
          Bookings and tickets
        </h2>
        <ul className="mt-3 space-y-4">
          {order.bookings.map((b) => (
            <li key={b.id} className="rounded-lg border border-line bg-surface p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">
                  {b.providerLabel}
                  {b.providerBookingId ? <span className="font-normal text-text-muted"> · ref {b.providerBookingId}</span> : null}
                </p>
                <Badge tone={b.tone}>{b.stateLabel}</Badge>
              </div>
              <p className="mt-1 text-body-sm text-text-muted">
                Seller payment: {b.settlementLabel.toLowerCase()} · Tickets: {b.fulfilmentLabel.toLowerCase()}
              </p>
              {b.tickets.length ? (
                <ul className="mt-4 divide-y divide-line rounded-md border border-line">
                  {b.tickets.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <span className="flex items-center gap-2">
                        <Icon name="ticket" size={18} className="text-text-muted" />
                        <span>
                          <span className="font-semibold">{t.typeLabel}</span>
                          {t.reference ? <span className="tnum ml-2 rounded-sm bg-paper px-1.5 py-0.5 font-mono text-body-sm">{t.reference}</span> : null}
                          <span className="block text-caption text-text-muted">Issued {formatDateTime(t.issuedAt)}</span>
                        </span>
                      </span>
                      {t.downloadUrl ? (
                        <a href={t.downloadUrl} className="inline-flex items-center gap-1 text-body-sm font-semibold underline" download>
                          <Icon name="download" size={16} />
                          Download
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-md bg-paper p-3 text-body-sm text-text-muted">
                  No tickets yet. They appear here only once {b.providerLabel} actually issues them.
                </p>
              )}
              <p className="mt-3 text-caption text-text-muted">
                Refund: {b.aftersales.refund} · Change: {b.aftersales.exchange} · Cancel: {b.aftersales.cancellation}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
