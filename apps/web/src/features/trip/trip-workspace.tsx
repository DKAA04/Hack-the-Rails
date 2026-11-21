"use client";
import { useId, useMemo, useState } from "react";
import { Icon } from "../../components/icons";
import { Badge, Button, ButtonLink, PageHeader, Skeleton, cx } from "../../components/ui";
import { formatDuration, minutesBetween, plural } from "../../lib/format";
import { ModeStrip } from "../comparison/journey-card";
import { JourneyTimeline } from "../comparison/journey-timeline";
import { MODE_LABEL, type JourneyView } from "../comparison/mappers/journey";
import { findConflicts, nameOf, tripTotal, type Conflict } from "./conflicts";
import { useTrip } from "./store";

export function TripWorkspace() {
  const trip = useTrip();
  const { items, ready } = trip;
  const conflicts = useMemo(() => findConflicts(items), [items]);
  const total = useMemo(() => tripTotal(items), [items]);
  const [announce, setAnnounce] = useState("");

  if (!ready)
    return (
      <>
        <PageHeader title="Your trip" />
        <div className="space-y-4" aria-label="Loading trip">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </>
    );

  if (!items.length)
    return (
      <>
        <PageHeader title="Your trip" description="Build one journey out of many: different modes, different sellers." />
        <div className="rounded-lg border border-dashed border-line-strong bg-surface p-6 md:p-10">
          <Icon name="route" size={32} className="text-lime-deep" />
          <h2 className="mt-4 font-display text-title-lg">Nothing here yet</h2>
          <p className="mt-2 max-w-[60ch] text-body text-text-muted">
            Search a route, then press <strong>Add to trip</strong> on any journey. Mix a train with a ferry or a coach
            with a flight. We&apos;ll check every connection for overlaps, tight changes and gaps between stations.
          </p>
          <ButtonLink href="/" icon="search" className="mt-6">
            Find journeys
          </ButtonLink>
          {trip.saved.length ? (
            <p className="mt-6 text-body-sm text-text-muted">
              You have {plural(trip.saved.length, "saved trip")}.{" "}
              <a href="/account#saved" className="underline">
                Open one
              </a>
            </p>
          ) : null}
        </div>
      </>
    );

  const first = items[0]!;
  const last = items[items.length - 1]!;
  const span = minutesBetween(first.departureUtc, last.arrivalUtc);
  const dangers = conflicts.filter((c) => c.severity === "danger");
  const notBookable = conflicts.filter((c) => c.kind === "not_bookable");
  const checks: Pick<Conflict, "severity" | "message">[] = [
    ...conflicts.filter((c) => c.kind !== "not_bookable"),
    ...(notBookable.length
      ? [
          {
            severity: "warn" as const,
            message:
              notBookable.length === items.length
                ? "Every journey here is timetable only, so there's nothing to book yet. Use it as your plan."
                : `${plural(notBookable.length, "journey")} can't be booked here yet (timetable only or not a live price).`,
          },
        ]
      : []),
  ];
  const bookable = items.filter((j) => j.bookable && !trip.ordered[j.id]);
  const conflictsFor = (id: string) => conflicts.filter((c) => c.between[0] === id && c.between.length === 2);

  function move(j: JourneyView, delta: -1 | 1) {
    trip.move(j.id, delta);
    const i = items.findIndex((x) => x.id === j.id) + delta;
    setAnnounce(`${nameOf(j)} moved to position ${i + 1} of ${items.length}.`);
    window.setTimeout(() => document.getElementById(`trip-move-${j.id}-${delta}`)?.focus(), 0);
  }

  return (
    <>
      <PageHeader
        title={`${first.origin.name} to ${last.destination.name}`}
        description={`${plural(items.length, "leg")}${trip.options.length ? ` + ${plural(trip.options.length, "option")}` : ""} · ${span >= 0 && !dangers.length ? formatDuration(span) + " end to end" : "legs overlap"} · ${[...new Set(items.flatMap((j) => j.modes))]
          .filter((m) => m !== "walking" && m !== "transfer")
          .map((m) => MODE_LABEL[m].toLowerCase())
          .join(", ")}`}
      />
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="min-w-0">
        <ol aria-label="Trip legs" className="space-y-0">
          {items.map((j, i) => (
            <li key={j.id}>
              <TripItem
                journey={j}
                orderId={trip.ordered[j.id] ?? null}
                index={i}
                count={items.length}
                onMove={(d) => move(j, d)}
                onRemove={() => {
                  trip.remove(j.id);
                  setAnnounce(`Removed ${nameOf(j)}.`);
                }}
              />
              {i < items.length - 1 ? <Connection a={j} b={items[i + 1]!} conflicts={conflictsFor(j.id)} /> : null}
            </li>
          ))}
        </ol>
        {trip.options.length ? (
          <section aria-labelledby="options-title" className="mt-8">
            <h2 id="options-title" className="text-title">
              Options you&apos;re comparing
            </h2>
            <p className="mt-1 text-body-sm text-text-muted">
              Alternatives for a leg already in your trip. They don&apos;t count towards the total or the checks.
            </p>
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
              {trip.options.map((o) => (
                <li key={o.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="tnum font-semibold">
                      {o.departureLocal}–{o.arrivalLocal}
                      <span className="font-normal text-text-muted"> · {o.dateLabel} · {formatDuration(o.durationMinutes)} · {o.changes === 0 ? "direct" : plural(o.changes, "change")}</span>
                    </p>
                    <p className="text-body-sm text-text-muted">
                      {o.origin.name} → {o.destination.name} · {o.price.kind === "unknown" ? "price unknown" : `${o.price.display} (${o.price.kindLabel.toLowerCase()})`}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => {
                    trip.promoteOption(o.id);
                    setAnnounce(`Using ${nameOf(o)} instead. The leg it replaced is now an option.`);
                  }}>
                    Use this instead
                  </Button>
                  <Button size="sm" variant="quiet" icon="trash" aria-label={`Remove option ${nameOf(o)}`} onClick={() => trip.remove(o.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        </div>

        <aside id="trip-summary" aria-label="Trip summary" className="on-ink rounded-lg bg-ink p-6 text-white lg:sticky lg:top-24">
          <h2 className="text-title">Trip total</h2>
          <p className="tnum mt-2 font-display text-headline">{total.knownDisplay}</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            {total.complete
              ? "Complete total from the sellers' prices. No Wayward fee added."
              : [
                  total.unknownCount ? `${plural(total.unknownCount, "journey")} with unknown price not included` : null,
                  total.partialCount ? `${plural(total.partialCount, "price")} missing components` : null,
                  total.known.length > 1 ? "different currencies, not converted" : null,
                ]
                  .filter(Boolean)
                  .join("; ") + "."}
          </p>

          <div className="mt-6 border-t border-ink-line pt-4">
            <h3 className="text-label">Checks</h3>
            {checks.length ? (
              <ul className="mt-2 space-y-2 text-body-sm">
                {checks.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <Icon name="alert" size={16} className={cx("mt-0.5 shrink-0", c.severity === "danger" ? "text-danger-on-ink" : "text-warn-on-ink")} />
                    <span className="text-ink-muted">{c.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 flex gap-2 text-body-sm text-ink-muted">
                <Icon name="check" size={16} className="mt-0.5 text-lime" />
                Connections line up. We&apos;ll recheck times and prices before you pay.
              </p>
            )}
            {conflicts.some((c) => c.kind === "out_of_order") ? (
              <Button variant="quiet" size="sm" className="mt-3 text-white underline hover:bg-ink-raised" onClick={trip.sortByDeparture}>
                Sort by departure
              </Button>
            ) : null}
          </div>

          <div className="mt-6">
            {!bookable.length || dangers.length > 0 ? (
              <button
                type="button"
                aria-disabled="true"
                onClick={(e) => e.preventDefault()}
                aria-describedby="checkout-reason"
                className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-ink-line bg-ink-raised font-semibold text-ink-muted"
              >
                Continue to checkout
              </button>
            ) : (
              <ButtonLink href="/checkout" iconAfter="arrow-right" className="w-full" aria-describedby="checkout-reason">
                Continue to checkout
              </ButtonLink>
            )}
            <p id="checkout-reason" className="mt-2 text-caption text-ink-muted">
              {dangers.length
                ? "Fix the impossible connection first."
                : !bookable.length
                  ? items.some((j) => trip.ordered[j.id])
                    ? "Everything bookable here already has an order. Check its status from the journey."
                    : "Nothing in this trip is bookable yet: timetable journeys have no seller or price."
                  : bookable.length < items.length
                    ? `${bookable.length} of ${items.length} journeys can be booked. The rest stay in your plan.`
                    : "A timetable is not a reservation. A payment is not a ticket."}
            </p>
          </div>
          <SaveTrip />
          <ClearTrip />
        </aside>
      </div>
      <div aria-hidden="true" className="h-20 lg:hidden" />
      <div className="on-ink fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 border-t border-ink-line bg-ink px-4 py-3 text-white md:bottom-0 lg:hidden">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
          <p className="min-w-0">
            <span className="tnum block font-semibold">{total.knownDisplay}</span>
            <span className="block truncate text-caption text-ink-muted">
              {dangers.length ? plural(dangers.length, "impossible connection") : checks.length ? plural(checks.length, "thing to check") : "Connections line up"}
            </span>
          </p>
          <a href="#trip-summary" className="inline-flex h-11 shrink-0 items-center rounded-md bg-lime px-4 text-label text-ink no-underline">
            Summary
          </a>
        </div>
      </div>
    </>
  );
}

function ClearTrip() {
  const trip = useTrip();
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div role="group" aria-label="Confirm clearing the trip" className="mt-3 flex flex-wrap items-center gap-2 text-body-sm">
      <span className="text-ink-muted">Remove every leg and option?</span>
      <Button size="sm" variant="danger" autoFocus onClick={() => { trip.clear(); setConfirm(false); }}>
        Clear trip
      </Button>
      <Button size="sm" variant="quiet" className="text-white hover:bg-ink-raised" onClick={() => setConfirm(false)}>
        Keep it
      </Button>
    </div>
  ) : (
    <Button variant="quiet" size="sm" icon="trash" className="mt-2 text-ink-muted hover:bg-ink-raised hover:text-white" onClick={() => setConfirm(true)}>
      Clear trip
    </Button>
  );
}

function TripItem({
  journey: j,
  orderId,
  index,
  count,
  onMove,
  onRemove,
}: {
  journey: JourneyView;
  orderId: string | null;
  index: number;
  count: number;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const label = `${j.origin.name} to ${j.destination.name}`;
  const spoken = nameOf(j);
  return (
    <article aria-label={`Leg ${index + 1}: ${spoken} to ${j.destination.name}`} className="rounded-lg border border-line bg-surface p-4 shadow-rest sm:p-6">
      <div className="flex items-start gap-4">
        <span className="tnum flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-label text-white">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-3">
            <span className="tnum text-data">
              {j.departureLocal}–{j.arrivalLocal}
              {j.arrivalDayOffset ? <sup className="ml-0.5 text-caption text-warn">+{j.arrivalDayOffset}</sup> : null}
            </span>
            <span className="text-body-sm text-text-muted">
              {j.dateLabel} · {formatDuration(j.durationMinutes)}
            </span>
          </p>
          <p className="mt-1 font-semibold break-words">{label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ModeStrip journey={j} />
            <Badge tone={j.price.kindTone}>{j.price.kind === "unknown" ? "Price unknown" : `${j.price.display} · ${j.price.kindLabel}`}</Badge>
            <span className="text-caption text-text-muted">{j.seller ? `Sold by ${j.seller.name}` : `${j.providerLabel}, timetable only`}</span>
            {orderId ? (
              <a href={`/orders/${encodeURIComponent(orderId)}`} className="inline-flex min-h-6 items-center gap-1 text-caption font-semibold underline">
                <Icon name="ticket" size={14} />
                Order placed · view status
              </a>
            ) : null}
            {j.overnight ? (
              <Badge tone="info" icon="moon">
                Overnight
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <button
            id={`trip-move-${j.id}--1`}
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move ${spoken} earlier`}
            className="flex size-11 items-center justify-center rounded-md border border-line-strong hover:border-ink disabled:opacity-30"
          >
            <Icon name="arrow-up" size={16} />
          </button>
          <button
            id={`trip-move-${j.id}-1`}
            type="button"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            aria-label={`Move ${spoken} later`}
            className="flex size-11 items-center justify-center rounded-md border border-line-strong hover:border-ink disabled:opacity-30"
          >
            <Icon name="arrow-down" size={16} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${spoken}`}
            className="flex size-11 items-center justify-center rounded-md border border-line-strong text-danger hover:border-danger hover:bg-danger-wash"
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="quiet" size="sm" iconAfter="chevron-down" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide timeline" : "Timeline"}
        </Button>
      </div>
      <div id={id} hidden={!open} className="mt-2 border-t border-line pt-4">
        {open ? <JourneyTimeline journey={j} /> : null}
      </div>
    </article>
  );
}

function Connection({ a, b, conflicts }: { a: JourneyView; b: JourneyView; conflicts: Conflict[] }) {
  const gap = minutesBetween(a.arrivalUtc, b.departureUtc);
  const worst = conflicts.find((c) => c.severity === "danger") ?? conflicts[0];
  const tone = worst ? (worst.severity === "danger" ? "danger" : "warn") : "ok";
  return (
    <div className="flex flex-col items-start py-2 pl-[1.9rem] sm:pl-[2.4rem]">
      <span aria-hidden="true" className="h-3 border-l-2 border-dashed border-line-strong" />
      <p
        className={cx(
          "flex w-full items-start gap-2 rounded-md px-3 py-2 text-body-sm",
          tone === "danger" ? "bg-danger-wash text-danger" : tone === "warn" ? "bg-warn-wash text-warn" : "bg-transparent text-text-muted",
        )}
      >
        <Icon name={tone === "ok" ? "check" : "alert"} size={16} className="mt-0.5 shrink-0" />
        <span>
          {worst
            ? worst.message
            : `${formatDuration(gap)} at ${a.destination.name} before the next journey. Separate bookings, so plan for delays.`}
        </span>
      </p>
      <span aria-hidden="true" className="h-3 border-l-2 border-dashed border-line-strong" />
    </div>
  );
}

function SaveTrip() {
  const trip = useTrip();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="mt-6 border-t border-ink-line pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        trip.saveCurrent(name.trim() || "Untitled trip");
        setName("");
        setSaved(true);
      }}
    >
      <label htmlFor="trip-name" className="text-label">
        Save this trip on this device
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="trip-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          placeholder="Summer in Porto"
          className="h-10 min-w-0 flex-1 rounded-md border border-ink-line bg-ink-raised px-3 text-white placeholder:text-ink-muted"
        />
        <Button type="submit" variant="ghost" size="sm">
          Save
        </Button>
      </div>
      <p role="status" className="mt-1 min-h-5 text-caption text-ink-muted">
        {saved ? "Saved. Find it under Account." : "Saved trips stay in this browser until accounts exist."}
      </p>
    </form>
  );
}

