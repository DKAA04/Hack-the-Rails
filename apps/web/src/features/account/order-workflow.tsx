"use client";
import type { ReactNode } from "react";
import { Icon } from "../../components/icons";
import { Badge, Button, ButtonLink, Notice, cx } from "../../components/ui";
import { formatDateTime } from "../../lib/format";
import type { ErrorView } from "../common/mappers/errors";
import { PHASE_COPY, PROGRESS, type NextAction, type OrderView } from "../checkout/mappers/order";

const ACTION_LABEL: Partial<Record<NextAction, string>> = {
  provide_travellers: "Add traveller details",
  reserve: "Reserve with the seller",
  checkout: "Continue to payment",
  accept_changes: "Check the new price",
};

/**
 * Renders order.workflow: the phase in plain language, the next action, and
 * deadlines only when the backend knows them (null = unknown, so hidden).
 */
export function OrderWorkflowPanel({
  order,
  onAction,
  busy = false,
  actionError,
  polling,
  pollMs,
  lastChecked,
  travellerAction,
}: {
  order: OrderView;
  onAction?: (a: NextAction) => void;
  busy?: boolean;
  actionError?: ErrorView | null;
  polling: boolean;
  pollMs: number | null;
  lastChecked: number | null;
  /** Override for provide_travellers when this screen holds no traveller data. */
  travellerAction?: ReactNode;
}) {
  const w = order.workflow;
  if (!w)
    return (
      <Notice tone="neutral" title={`Order ${order.stateLabel.toLowerCase()}`}>
        {order.explain} Detailed booking progress isn&apos;t available for this order.
      </Notice>
    );

  const exception = w.progressIndex === -1;
  const label = ACTION_LABEL[w.nextAction];

  return (
    <section aria-labelledby="workflow-title" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[60ch]">
          <h2 id="workflow-title" className="font-display text-title-lg">
            {w.title}
          </h2>
          <p className="mt-1 text-body text-text-muted">{w.body}</p>
        </div>
        {order.environment === "test" ? <Badge tone="warn">Test environment</Badge> : null}
      </div>

      {w.reasons.length ? (
        <ul className="mt-3 space-y-1 text-body-sm">
          {w.reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <Icon name="info" size={16} className="mt-0.5 shrink-0 text-text-muted" />
              {r}
            </li>
          ))}
        </ul>
      ) : null}

      {w.paymentRequiredBy || w.priceGuaranteeExpiresAt ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {w.paymentRequiredBy ? (
            <div className="rounded-md bg-warn-wash p-3">
              <dt className="text-caption text-text-muted">Pay by</dt>
              <dd className="tnum font-semibold">{formatDateTime(w.paymentRequiredBy)}</dd>
            </div>
          ) : null}
          {w.priceGuaranteeExpiresAt ? (
            <div className="rounded-md bg-paper p-3">
              <dt className="text-caption text-text-muted">Price guaranteed until</dt>
              <dd className="tnum font-semibold">{formatDateTime(w.priceGuaranteeExpiresAt)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {/* Announce phase changes only; the polling timestamp stays out of the live region. */}
      <p className="sr-only" aria-live="polite">
        {w.title}
      </p>
      <div className="mt-5">
        {w.nextAction === "poll" && !w.terminal ? (
          <p className="flex items-center gap-2 text-body-sm text-text-muted">
            <span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-text-subtle border-r-transparent" />
            {polling && pollMs !== null
              ? `Checking again every ${Math.max(1, Math.round(pollMs / 1000))}s.`
              : "Waiting for an update."}
            {lastChecked ? ` Last checked ${new Date(lastChecked).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.` : ""}
          </p>
        ) : w.nextAction === "contact_support" || w.phase === "manual_review" ? (
          <Notice tone="warn" title="What to do now">
            Nothing will be retried automatically, so nothing will be charged twice. Wayward doesn&apos;t have a support
            desk set up yet: keep your order reference <span className="font-mono [overflow-wrap:anywhere]">{order.id}</span>, and check
            your email for anything from the seller.
          </Notice>
        ) : w.phase === "failed" || w.phase === "expired" ? (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/" icon="search">
              Search again
            </ButtonLink>
            <ButtonLink href="/trip" variant="ghost" icon="route">
              Back to trip
            </ButtonLink>
          </div>
        ) : w.nextAction === "provide_travellers" && travellerAction ? (
          travellerAction
        ) : label && onAction ? (
          <Button onClick={() => onAction(w.nextAction)} loading={busy} disabled={busy} iconAfter="arrow-right">
            {label}
          </Button>
        ) : null}
        {actionError ? (
          <Notice
            tone={actionError.kind === "not_implemented" ? "info" : "danger"}
            role="alert"
            title={actionError.kind === "not_implemented" ? `${label ?? "This step"} isn't available yet` : actionError.title}
            className="mt-3"
          >
            {actionError.kind === "not_implemented"
              ? "Wayward can't do this step yet, so nothing was reserved or charged. Your order is saved as it is."
              : actionError.message}
          </Notice>
        ) : null}
      </div>

      <details className="group mt-6 border-t border-line pt-4" open={!exception && !w.terminal}>
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 text-label">
          <Icon name="chevron-right" size={16} className="transition-transform group-open:rotate-90" />
          All steps
        </summary>
        <ol className="mt-2 grid gap-1 sm:grid-cols-3">
          {PROGRESS.map((p, i) => {
            const done = !exception && i < w.progressIndex;
            const current = p === w.phase;
            return (
              <li
                key={p}
                aria-current={current ? "step" : undefined}
                className={cx(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-body-sm",
                  current ? "bg-ink font-semibold text-white" : done ? "text-ink" : "text-text-muted",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-caption",
                    current ? "border-lime bg-lime text-ink" : done ? "border-ok bg-ok-wash text-ok" : "border-line-strong",
                  )}
                >
                  {done ? <Icon name="check" size={12} /> : i + 1}
                </span>
                {PHASE_COPY[p].step}
                <span className="sr-only">{current ? " (current)" : done ? " (done)" : ""}</span>
              </li>
            );
          })}
        </ol>
        {exception ? (
          <p className="mt-2 text-caption text-text-muted">
            Current status sits outside the usual steps: <strong>{PHASE_COPY[w.phase].step}</strong>.
          </p>
        ) : null}
      </details>
    </section>
  );
}
