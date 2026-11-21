"use client";
import { useId, useState } from "react";
import { Icon } from "../../components/icons";
import { Badge, Button, cx } from "../../components/ui";
import { formatDuration, plural } from "../../lib/format";
import { useTrip } from "../trip/store";
import { JourneyTimeline } from "./journey-timeline";
import { MODE_LABEL, type JourneyView } from "./mappers/journey";
import { PICK_TITLE, type PickKey } from "./picks";

const COLS = "grid-cols-[1fr_auto] md:grid-cols-[9rem_5.5rem_6rem_1fr_auto]";

/** Timetable-only journeys as compact departure-board rows. No prices: none exist. */
export function DepartureBoard({
  journeys,
  picksFor,
  title,
  note,
}: {
  journeys: JourneyView[];
  picksFor: (id: string) => PickKey[];
  title: string;
  note: string;
}) {
  return (
    <section aria-labelledby="board-title" className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3 sm:px-6">
        <h3 id="board-title" className="text-title">
          {title}
        </h3>
        <p className="text-caption text-text-muted">{note}</p>
      </div>
      <div aria-hidden="true" className={cx("hidden gap-4 border-b border-line bg-paper px-6 py-2 text-caption text-text-muted md:grid", COLS)}>
        <span>Departs → arrives</span>
        <span>Duration</span>
        <span>Changes</span>
        <span>Operator</span>
        <span className="sr-only">Actions</span>
      </div>
      <ol aria-labelledby="board-title" className="divide-y divide-line">
        {journeys.map((j) => (
          <li key={j.id}>
            <DepartureRow journey={j} picks={picksFor(j.id)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function DepartureRow({ journey: j, picks }: { journey: JourneyView; picks: PickKey[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trip = useTrip();
  const role = trip.roleOf(j.id);
  const [note, setNote] = useState("");
  const travel = j.legs.filter((l) => l.mode !== "walking" && l.mode !== "transfer");
  const modes = [...new Set((travel.length ? travel : j.legs).map((l) => l.mode))];
  const label = `${j.departureLocal} to ${j.arrivalLocal}, ${formatDuration(j.durationMinutes)}, ${j.changes === 0 ? "direct" : plural(j.changes, "change")}`;

  return (
    <div id={`journey-${j.id}`} className="scroll-mt-24">
      <div className={cx("grid items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-6", COLS)}>
        <p className="tnum text-data">
          {j.departureLocal}
          <span className="mx-1 text-text-subtle" aria-hidden="true">
            →
          </span>
          <span className="sr-only"> to </span>
          {j.arrivalLocal}
          {j.arrivalDayOffset ? <sup className="ml-0.5 text-caption text-warn">+{j.arrivalDayOffset}</sup> : null}
        </p>
        <div className="col-start-2 row-start-1 flex items-center justify-end gap-1 md:col-start-5">
          <Button
            variant="quiet"
            size="sm"
            aria-expanded={open}
            aria-controls={id}
            aria-label={`${open ? "Hide" : "Show"} stops for ${label}`}
            onClick={() => setOpen((v) => !v)}
            className={cx("px-2 [&>svg]:transition-transform", open && "[&>svg]:rotate-180")}
            iconAfter="chevron-down"
          >
            <span className="hidden sm:inline">Stops</span>
          </Button>
          <Button
            variant={role ? "secondary" : "ghost"}
            size="sm"
            icon={role ? "check" : "plus"}
            aria-pressed={!!role}
            aria-label={role ? `Remove ${label} from trip` : `Add ${label} to trip`}
            onClick={() => {
              if (role) {
                trip.remove(j.id);
                setNote("Removed from your trip.");
              } else {
                const r = trip.add(j);
                setNote(r === "option" ? "Saved as an option to compare." : "Added to your trip.");
              }
            }}
          >
            {role === "option" ? "Option" : role ? "In trip" : "Add"}
          </Button>
        </div>
        <p className="tnum col-span-2 text-body-sm text-text-muted md:col-span-1 md:text-body md:text-ink">
          <span className="md:hidden">{formatDuration(j.durationMinutes)} · {j.changes === 0 ? "direct" : plural(j.changes, "change")}</span>
          <span className="hidden md:inline">{formatDuration(j.durationMinutes)}</span>
        </p>
        <p className="hidden text-body md:block">
          {j.changes === 0 ? "Direct" : j.changes}
          {j.worstTransfer === "tight" || j.worstTransfer === "impossible" ? (
            <Badge tone={j.worstTransfer === "impossible" ? "danger" : "warn"} className="ml-2">
              {j.worstTransfer === "impossible" ? "Can't make" : "Tight"}
            </Badge>
          ) : null}
        </p>
        <p className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body-sm md:col-span-1">
          <span className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 flex shrink-0 items-center gap-1" role="img" aria-label={modes.map((m) => MODE_LABEL[m]).join(", ")}>
              {modes.map((m) => (
                <Icon key={m} name={m} size={16} />
              ))}
            </span>
            <span className="min-w-0 text-text-muted">{j.operators.join(", ") || "Operator not given"}</span>
          </span>
          {j.overnight ? (
            <Badge tone="info" icon="moon">
              Overnight
            </Badge>
          ) : null}
          {picks.map((p) => (
            <Badge key={p} tone="lime">
              {PICK_TITLE[p]}
            </Badge>
          ))}
          <span className="md:hidden">
            {j.worstTransfer === "tight" ? <Badge tone="warn">Tight change</Badge> : null}
            {j.worstTransfer === "impossible" ? <Badge tone="danger">Can&apos;t make</Badge> : null}
          </span>
        </p>
      </div>
      <p role="status" className={note ? "px-4 pb-2 text-caption text-text-muted sm:px-6" : "sr-only"}>
        {note}
      </p>
      <div id={id} hidden={!open} className="border-t border-line bg-paper px-4 py-4 sm:px-6">
        {open ? (
          <>
            <JourneyTimeline journey={j} />
            {j.attribution ? <p className="mt-3 text-caption text-text-muted">Source: {j.attribution}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
