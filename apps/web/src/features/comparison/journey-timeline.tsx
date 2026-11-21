import type { ReactNode } from "react";
import { Icon } from "../../components/icons";
import { Badge, cx } from "../../components/ui";
import { formatDuration } from "../../lib/format";
import type { JourneyView, LegView, TransferView } from "./mappers/journey";

type Rail = "solid" | "dashed" | "none";

/** One timeline row: time column, rail column, content column. */
function Row({
  time,
  rail,
  railAbove = rail,
  dot,
  children,
}: {
  time?: ReactNode;
  rail: Rail;
  railAbove?: Rail;
  dot?: boolean;
  children: ReactNode;
}) {
  const line = (r: Rail) =>
    r === "solid" ? "bg-ink w-0.5" : r === "dashed" ? "border-l-2 border-dashed border-line-strong" : "";
  return (
    <div className="grid grid-cols-[3.5rem_1.5rem_1fr] gap-x-3">
      <div className="tnum pt-0.5 text-right text-body font-bold">{time}</div>
      <div className="relative flex justify-center" aria-hidden="true">
        {dot ? (
          <>
            <span className={cx("absolute top-0 h-2.5", line(railAbove))} />
            <span className={cx("absolute top-2.5 bottom-0", line(rail))} />
            <span className="relative z-10 mt-1.5 size-3 rounded-full border-2 border-ink bg-surface" />
          </>
        ) : (
          <span className={cx("absolute inset-y-0", line(rail))} />
        )}
      </div>
      <div className="min-w-0 pb-3">{children}</div>
    </div>
  );
}

function DayOffset({ n }: { n: number }) {
  if (!n) return null;
  return (
    <sup className="ml-0.5 text-caption font-semibold text-warn">
      +{n}
      <span className="sr-only"> {n === 1 ? "day" : "days"} later</span>
    </sup>
  );
}

function LegInfo({ leg }: { leg: LegView }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1 text-body-sm">
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <Icon name={leg.mode} size={16} />
        {leg.modeLabel}
      </span>
      {leg.operator ? <span className="text-text-muted">{leg.operator}</span> : null}
      <span className="tnum text-text-muted">{formatDuration(leg.durationMinutes)}</span>
      {leg.overnight ? (
        <Badge tone="info" icon="moon">
          Overnight
        </Badge>
      ) : null}
      {leg.timetableStatus === "cancelled" ? (
        <Badge tone="danger" icon="alert">
          Cancelled
        </Badge>
      ) : leg.timetableStatus === "estimated" ? (
        <Badge tone="warn">Estimated times</Badge>
      ) : null}
    </div>
  );
}

function TransferInfo({ t }: { t: TransferView }) {
  return (
    <div
      className={cx(
        "rounded-md p-3 text-body-sm",
        t.tone === "danger" ? "bg-danger-wash" : t.tone === "warn" ? "bg-warn-wash" : "bg-paper",
      )}
    >
      <p className="flex flex-wrap items-center gap-2">
        <Icon name="transfer" size={16} />
        <span className="font-semibold">Change at {t.atPlace}</span>
        <Badge tone={t.tone}>
          {t.ratingLabel} · <span className="tnum">{formatDuration(t.durationMinutes)}</span>
        </Badge>
      </p>
      <p className="mt-1 text-text-muted">{t.explanation}</p>
      {t.instructions ? <p className="mt-1">{t.instructions}</p> : null}
    </div>
  );
}

export function JourneyTimeline({ journey }: { journey: JourneyView }) {
  const { legs, transfers } = journey;
  return (
    <div>
      <ol aria-label="Journey timeline">
        {legs.map((leg, i) => {
          const transfer = transfers.find((t) => t.fromLegId === leg.id);
          const next = legs[i + 1];
          const first = i === 0;
          const last = !next;
          return (
            <li key={leg.id}>
              <Row time={leg.departureLocal} dot railAbove={first ? "none" : "dashed"} rail="solid">
                <span className="font-semibold">{leg.origin.name}</span>
                <span className="sr-only">, departs {leg.departureLocal}</span>
              </Row>
              <Row rail="solid">
                <LegInfo leg={leg} />
              </Row>
              <Row
                time={
                  <>
                    {leg.arrivalLocal}
                    <DayOffset n={leg.arrivalDayOffset} />
                  </>
                }
                dot
                railAbove="solid"
                rail={last ? "none" : "dashed"}
              >
                <span className={last ? "font-semibold" : "text-text-muted"}>{leg.destination.name}</span>
                <span className="sr-only">, arrives {leg.arrivalLocal}</span>
              </Row>
              {transfer ? (
                <Row rail="dashed">
                  <TransferInfo t={transfer} />
                </Row>
              ) : next && next.origin.id !== leg.destination.id ? (
                <Row rail="dashed">
                  <p className="flex gap-1 text-body-sm text-warn">
                    <Icon name="alert" size={16} className="shrink-0" />
                    The next leg starts from {next.origin.name}. The source gave no connection details.
                  </p>
                </Row>
              ) : null}
            </li>
          );
        })}
      </ol>
      {journey.missingConnections.length ? (
        <div className="mt-2 rounded-md bg-warn-wash p-3 text-body-sm">
          <p className="font-semibold">Not covered by this result</p>
          <ul className="mt-1 list-disc pl-5 text-text-muted">
            {journey.missingConnections.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
