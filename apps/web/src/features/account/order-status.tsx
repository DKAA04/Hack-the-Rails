import { Icon, type IconName } from "../../components/icons";
import { Badge, cx } from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import type { OrderView } from "../checkout/mappers/order";

const AFTERSALE: Record<string, string> = { supported: "Allowed", unsupported: "Not allowed", unknown: "Unknown" };
const STEP_ICON: Record<string, IconName> = { pending: "clock", confirmed: "check", partial: "alert", failed: "alert", cancelled: "close", draft: "info" };

export function OrderStatus({ order, sample = false }: { order: OrderView; sample?: boolean }) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-surface p-4 sm:p-6" aria-labelledby="order-state">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-caption text-text-muted [overflow-wrap:anywhere]">
              Order {order.id} · placed {formatDateTime(order.createdAt)}
              {order.updatedAt ? ` · updated ${formatDateTime(order.updatedAt)}` : ""}
            </p>
            {order.workflow ? (
              // The workflow panel owns the headline; this section only shows the separate tracks.
              <h2 id="order-state" className="mt-1 text-title">
                Order details
              </h2>
            ) : (
              <>
                <h2 id="order-state" className="mt-1 flex items-center gap-2 font-display text-title-lg">
                  <Icon name={STEP_ICON[order.state] ?? "info"} size={24} className={cx(order.tone === "ok" ? "text-ok" : order.tone === "danger" ? "text-danger" : order.tone === "warn" ? "text-warn" : "text-text-muted")} />
                  {order.stateLabel}
                </h2>
                <p className="mt-1 max-w-[60ch] text-body-sm text-text-muted">{order.explain}</p>
              </>
            )}
          </div>
          <div className="sm:text-right">
            <p className="tnum font-display text-title-lg">{order.total.display}</p>
            <Badge tone={order.total.kindTone}>{order.total.kindLabel}</Badge>
          </div>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-paper p-3">
            <dt className="text-caption text-text-muted">Order record</dt>
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
                  {b.stateLabel === "Confirmed" ? "Booked via" : "Via"} {b.providerLabel}
                  {b.providerBookingId ? <span className="font-normal text-text-muted"> · ref {b.providerBookingId}</span> : null}
                </p>
                <Badge tone={b.tone}>{b.stateLabel}</Badge>
              </div>
              <p className="mt-1 text-body-sm text-text-muted">
                Seller payment: {b.settlementLabel.toLowerCase()} · Tickets: {b.fulfilmentLabel.toLowerCase()}
              </p>
              <h3 className="mt-4 text-label">Tickets and references</h3>
              {b.tickets.length || b.supplierDocuments.length ? (
                <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                  {b.supplierDocuments.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <span className="flex min-w-0 items-start gap-2">
                        <Icon name="ticket" size={18} className="mt-0.5 shrink-0 text-text-muted" />
                        <span className="min-w-0">
                          <span className="font-semibold">{d.typeLabel}</span>
                          <span className="tnum ml-2 rounded-sm bg-paper px-1.5 py-0.5 font-mono text-body-sm [overflow-wrap:anywhere]">{d.reference}</span>
                          <span className="block text-caption text-text-muted">
                            {d.issuedAt ? `Issued ${formatDateTime(d.issuedAt)}` : "The seller didn't give an issue time"}
                            {d.travellerCount ? ` · covers ${d.travellerCount} ${d.travellerCount === 1 ? "traveller" : "travellers"}` : ""}
                          </span>
                        </span>
                      </span>
                      {d.downloadUrl && !sample ? (
                        <a href={d.downloadUrl} className="inline-flex min-h-11 items-center gap-1 text-body-sm font-semibold underline">
                          <Icon name="download" size={16} />
                          Download
                        </a>
                      ) : (
                        <span className="text-caption text-text-muted">No PDF from the seller. Use this reference.</span>
                      )}
                    </li>
                  ))}
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
                      {t.downloadUrl && sample ? (
                        <span className="inline-flex items-center gap-1 text-body-sm text-text-muted">
                          <Icon name="download" size={16} />
                          Download (sample, no file)
                        </span>
                      ) : t.downloadUrl ? (
                        <a href={t.downloadUrl} className="inline-flex items-center gap-1 text-body-sm font-semibold underline" download>
                          <Icon name="download" size={16} />
                          Download
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-md bg-paper p-3 text-body-sm text-text-muted">
                  {b.fulfilmentLabel === "Ticketing failed" || (order.workflow?.terminal && order.workflow.phase !== "complete")
                    ? "No tickets were issued for this booking."
                    : `No tickets yet. They appear here once ${b.providerLabel} returns them.`}
                </p>
              )}
              {b.supplierDocuments.length && b.fulfilmentLabel !== "All tickets issued" ? (
                <p className="mt-2 text-caption text-text-muted">
                  The seller has returned {b.supplierDocuments.length === 1 ? "a reference" : "references"}, but hasn&apos;t marked
                  ticketing complete for every traveller yet.
                </p>
              ) : null}
              <p className="mt-3 text-caption text-text-muted">
                Refund: {AFTERSALE[b.aftersales.refund] ?? "Unknown"} · Change: {AFTERSALE[b.aftersales.exchange] ?? "Unknown"} · Cancel: {AFTERSALE[b.aftersales.cancellation] ?? "Unknown"}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
