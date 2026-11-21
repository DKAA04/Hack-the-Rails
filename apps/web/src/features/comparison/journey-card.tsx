"use client";
import { useId, useState } from "react";
import { Icon } from "../../components/icons";
import { Badge, Button, cx } from "../../components/ui";
import { formatDuration, plural } from "../../lib/format";
import { useTrip } from "../trip/store";
import { JourneyDetails } from "./journey-details";
import type { JourneyView } from "./mappers/journey";
import { PICK_TITLE, type PickKey } from "./picks";

export function ModeStrip({ journey }: { journey: JourneyView }) {
  const travel = journey.legs.filter((l) => l.mode !== "walking" && l.mode !== "transfer");
  const shown = travel.length ? travel : journey.legs;
  return (
    <span className="flex items-center gap-1 text-ink" aria-label={`By ${[...new Set(shown.map((l) => l.modeLabel.toLowerCase()))].join(", ")}`}>
      {shown.map((l, i) => (
        <span key={l.id} className="flex items-center gap-1">
          {i > 0 ? <span aria-hidden="true" className="h-px w-2 bg-line-strong" /> : null}
          <Icon name={l.mode} size={18} />
        </span>
      ))}
    </span>
  );
}

export function JourneyCard({
  journey,
  picks = [],
  expanded: expandedProp,
}: {
  journey: JourneyView;
  picks?: PickKey[];
  expanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(expandedProp ?? false);
  const detailsId = useId();
  const trip = useTrip();
  const role = trip.roleOf(journey.id);
  const inTrip = role !== null;
  const [note, setNote] = useState("");
  const j = journey;

  return (
    <article
      id={`journey-${j.id}`}
      aria-label={`${j.departureLocal} ${j.origin.name} to ${j.arrivalLocal} ${j.destination.name}, ${formatDuration(j.durationMinutes)}, ${j.price.display}`}
      className={cx(
        "scroll-mt-24 rounded-lg border bg-surface p-4 shadow-rest transition-shadow duration-200 hover:shadow-lift sm:p-6",
        "border-line",
      )}
    >
      {picks.length ? (
        <p className="mb-3 flex flex-wrap gap-2">
          {picks.map((p) => (
            <Badge key={p} tone="lime" icon="sparkle">
              {PICK_TITLE[p]}
            </Badge>
          ))}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start md:gap-8">
        <div className="min-w-0">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
            <span className="tnum text-data">{j.departureLocal}</span>
            <span className="flex min-w-0 flex-col items-center gap-1">
              <span className="tnum text-caption text-text-muted">{formatDuration(j.durationMinutes)}</span>
              <span aria-hidden="true" className="relative h-0.5 w-full rounded-full bg-line-strong">
                {j.legs.slice(1).map((_, i) => (
                  <span
                    key={i}
                    className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface"
                    style={{ left: `${((i + 1) / j.legs.length) * 100}%` }}
                  />
                ))}
              </span>
              <span className="text-caption text-text-muted">
                {j.changes === 0 ? "Direct" : plural(j.changes, "change")}
              </span>
            </span>
            <span className="tnum text-data">
              {j.arrivalLocal}
              {j.arrivalDayOffset ? (
                <sup className="ml-0.5 text-caption font-semibold text-warn">
                  +{j.arrivalDayOffset}
                  <span className="sr-only"> day</span>
                </sup>
              ) : null}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-4 text-body-sm">
            <span className="min-w-0 break-words">{j.origin.name}</span>
            <span className="min-w-0 break-words text-right">{j.destination.name}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <ModeStrip journey={j} />
            <span className="text-caption text-text-muted">
              {j.dateLabel}
              {j.operators.length ? ` · ${j.operators.slice(0, 3).join(", ")}${j.operators.length > 3 ? " +" + (j.operators.length - 3) : ""}` : ""}
            </span>
          </div>
          <p className="mt-3 flex flex-wrap gap-2">
            {j.overnight ? (
              <Badge tone="info" icon="moon">
                Overnight
              </Badge>
            ) : null}
            {j.worstTransfer === "impossible" ? (
              <Badge tone="danger" icon="alert">
                Connection can&apos;t be made
              </Badge>
            ) : j.worstTransfer === "tight" ? (
              <Badge tone="warn" icon="clock">
                Tight change
              </Badge>
            ) : null}
            {j.transfers.some((t) => t.protection === "self_transfer") ? (
              <Badge tone="warn">Self-transfer</Badge>
            ) : null}
            {j.completeness === "partial" ? <Badge tone="warn">Partial route</Badge> : null}
            {j.environment === "test" ? <Badge tone="warn">Test environment</Badge> : null}
            {j.freshness?.state === "stale" || j.freshness?.state === "expired" ? (
              <Badge tone={j.freshness.state === "expired" ? "danger" : "warn"}>
                {j.freshness.state === "expired" ? "Offer expired" : "Price may be stale"}
              </Badge>
            ) : null}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4 md:min-w-44 md:items-end md:border-t-0 md:pt-0">
          <div className="md:text-right">
            {j.price.kind === "unknown" ? (
              <p className="text-body-sm font-semibold whitespace-nowrap text-text-muted">Price unknown</p>
            ) : (
              <p className="tnum font-display text-title-lg">{j.price.display}</p>
            )}
            {j.price.kind !== "unknown" ? (
              <p className="mt-1 flex flex-wrap items-center gap-1 md:justify-end">
                <Badge tone={j.price.kindTone}>{j.price.kindLabel}</Badge>
                {j.price.completeness === "partial" ? <Badge tone="warn">Partial</Badge> : null}
              </p>
            ) : (
              <p className="mt-1 text-caption text-text-muted">Timetable only</p>
            )}
            {j.seller ? <p className="mt-1 text-caption text-text-muted">Sold by {j.seller.name}</p> : null}
          </div>
          <div className="flex justify-between gap-2 md:justify-end">
            <Button
              variant="quiet"
              size="sm"
              iconAfter="chevron-down"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded((v) => !v)}
              className={cx("[&>svg]:transition-transform", expanded && "[&>svg]:rotate-180")}
            >
              {expanded ? "Hide details" : "Details"}
            </Button>
            <Button
              variant={inTrip ? "secondary" : "ghost"}
              size="sm"
              icon={inTrip ? "check" : "plus"}
              onClick={() => {
                if (inTrip) {
                  trip.remove(j.id);
                  setNote("Removed from your trip.");
                } else {
                  const r = trip.add(j);
                  setNote(
                    r === "option"
                      ? "Saved as an option: it covers the same route or time as a leg already in your trip."
                      : "Added to your trip as the next leg.",
                  );
                }
              }}
              aria-pressed={inTrip}
            >
              {role === "option" ? "Saved option" : inTrip ? "In trip" : "Add to trip"}
            </Button>
          </div>
        </div>
      </div>

      <p role="status" className={note || (j.source === "offer" && !j.bookable) ? "mt-3 text-caption text-text-muted" : "sr-only"}>
        {note || (j.source === "offer" && !j.bookable ? j.notBookableReason : "")}
      </p>
      <div id={detailsId} hidden={!expanded} className="mt-4">
        {expanded ? <JourneyDetails journey={j} /> : null}
      </div>
    </article>
  );
}
