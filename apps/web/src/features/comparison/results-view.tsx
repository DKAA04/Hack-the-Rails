"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/icons";
import { Badge, Button, ButtonLink, Notice, Skeleton, cx } from "../../components/ui";
import { api } from "../../lib/api-client";
import { formatDateTime, formatDuration, plural } from "../../lib/format";
import { isAbort, toErrorView, type ErrorView } from "../common/mappers/errors";
import type { SearchFormState } from "../search/mappers/intent";
import { todayIso } from "../search/mappers/intent";
import { lastSearchFor, rerunLastSearch, searchWith, shiftIsoDate } from "../search/rerun";
import { SearchForm } from "../search/search-form";
import { useCapabilities } from "../search/use-capabilities";
import { DepartureBoard } from "./departure-board";
import { useTrip } from "../trip/store";
import { EMPTY_FILTERS, activeFilterCount, applyFilters, sortJourneys, type Filters, type SortKey } from "./filters";
import { FiltersPanel } from "./filters-panel";
import { JourneyCard } from "./journey-card";
import { toResultsView, type ResultsView as Results } from "./mappers/journey";
import { computePicks, dominantCurrency, type PickKey } from "./picks";

const STALE_AFTER_MS = 15 * 60_000;
const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const SORT_EXPLAIN: Record<SortKey, string> = {
  recommended: "Recommended: bookable first, then safer connections (tight and self-transfer changes drop down), then price and duration.",
  departure: "In departure order, like a departure board.",
  price: "Lowest known complete price first.",
  duration: "Shortest door-to-door time first.",
  changes: "Fewest changes first, then shortest.",
};

type Load =
  | { status: "loading" }
  | { status: "ready"; data: Results }
  | { status: "error"; error: ErrorView };

export function ResultsView({ searchId }: { searchId: string }) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<ErrorView | null>(null);
  const [route, setRoute] = useState<string | null>(null);
  const [canRerun, setCanRerun] = useState(false);
  const [last, setLast] = useState<SearchFormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [stepping, setStepping] = useState<-1 | 1 | null>(null);
  const { state: capabilities } = useCapabilities();
  const editRef = useRef<HTMLDivElement>(null);
  // When the in-place search opens, move focus to its first field.
  useEffect(() => {
    if (editing) editRef.current?.querySelector<HTMLElement>("input:not([type=radio]),button")?.focus();
  }, [editing]);

  const fetchResults = useCallback(
    (signal?: AbortSignal) => {
      setLoad({ status: "loading" });
      api
        .getSearch(searchId, signal)
        .then((r) => setLoad({ status: "ready", data: toResultsView(r) }))
        .catch((e) => {
          if (!isAbort(e)) setLoad({ status: "error", error: toErrorView(e) });
        });
    },
    [searchId],
  );

  useEffect(() => {
    const ac = new AbortController();
    fetchResults(ac.signal);
    const found = lastSearchFor(searchId);
    setLast(found);
    setCanRerun(!!found);
    setEditing(false);
    if (found?.origin && found.destination) setRoute(`${found.origin.name} to ${found.destination.name}`);
    return () => ac.abort();
  }, [fetchResults, searchId]);

  async function stepDay(delta: -1 | 1) {
    if (!last) return;
    setStepping(delta);
    setRerunError(null);
    try {
      const next: SearchFormState = {
        ...last,
        departureDate: shiftIsoDate(last.departureDate, delta),
        returnDate: last.tripType === "return" && last.returnDate ? shiftIsoDate(last.returnDate, delta) : last.returnDate,
      };
      const id = await searchWith(next);
      if (id) router.push(`/results/${encodeURIComponent(id)}`);
    } catch (e) {
      setRerunError(toErrorView(e));
    } finally {
      setStepping(null);
    }
  }

  async function rerun() {
    setRerunning(true);
    setRerunError(null);
    try {
      const id = await rerunLastSearch();
      if (id) router.replace(`/results/${encodeURIComponent(id)}`);
      else router.push("/");
    } catch (e) {
      setRerunError(toErrorView(e));
    } finally {
      setRerunning(false);
    }
  }

  const title =
    load.status === "ready" && load.data.journeys[0]
      ? `${load.data.journeys[0].origin.name} to ${load.data.journeys[0].destination.name}`
      : route ?? "Your results";

  return (
    <div className="pt-8 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-title-lg sm:text-headline">{title}</h1>
          {last ? (
            <p className="mt-1 text-body-sm text-text-muted">
              {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${last.departureDate}T00:00:00Z`))}
              {" · "}
              {last.passengers.length === 1 ? "1 traveller" : `${last.passengers.length} travellers`}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {last ? (
            <div role="group" aria-label="Change travel date" className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                icon="arrow-right"
                className="[&>svg]:rotate-180"
                onClick={() => stepDay(-1)}
                loading={stepping === -1}
                disabled={stepping !== null || shiftIsoDate(last.departureDate, -1) < todayIso(last.origin?.timeZone)}
                aria-label={`Earlier: search ${dayLabel(shiftIsoDate(last.departureDate, -1))}`}
              >
                {dayLabel(shiftIsoDate(last.departureDate, -1))}
              </Button>
              <span className="tnum px-2 text-label" aria-current="date">
                {dayLabel(last.departureDate)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                iconAfter="arrow-right"
                onClick={() => stepDay(1)}
                loading={stepping === 1}
                disabled={stepping !== null}
                aria-label={`Later: search ${dayLabel(shiftIsoDate(last.departureDate, 1))}`}
              >
                {dayLabel(shiftIsoDate(last.departureDate, 1))}
              </Button>
            </div>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            icon="search"
            aria-expanded={editing}
            aria-controls="edit-search"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Close search" : "Edit search"}
          </Button>
          {load.status === "ready" && canRerun ? (
            <Button variant="quiet" size="sm" icon="refresh" onClick={rerun} loading={rerunning} disabled={rerunning}>
              Refresh
            </Button>
          ) : null}
        </div>
      </div>
      {last ? (
        <p className="mt-2 text-caption text-text-muted">
          Earlier and later step a whole day. Choosing a time of day isn&apos;t supported by our sources yet: timetable searches start at 08:00.
        </p>
      ) : null}
      <div id="edit-search" ref={editRef} hidden={!editing} className="mt-4">
        {editing ? <SearchForm capabilities={capabilities} initial={last} compact /> : null}
      </div>
      {rerunError ? (
        <Notice tone="danger" role="alert" title={rerunError.title} className="mt-4">
          {rerunError.message}
        </Notice>
      ) : null}

      <p className="sr-only" role="status">
        {load.status === "loading" ? "Loading results" : load.status === "ready" ? `${load.data.journeys.length} journeys loaded` : ""}
      </p>
      <div aria-busy={load.status === "loading"}>
        {load.status === "loading" ? <ResultsSkeleton /> : null}
        {load.status === "error" ? (
          <ErrorState error={load.error} onRetry={() => fetchResults()} />
        ) : null}
        {load.status === "ready" ? <Loaded data={load.data} onRerun={canRerun ? rerun : null} rerunning={rerunning} /> : null}
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: ErrorView; onRetry: () => void }) {
  const notFound = error.kind === "not_found";
  return (
    <div className="mt-8 rounded-lg border border-line bg-surface p-6 md:p-8">
      <Icon name={error.kind === "offline" ? "offline" : "alert"} size={28} className="text-danger" />
      <h2 className="mt-3 font-display text-title-lg">{notFound ? "This search isn't available" : error.title}</h2>
      <p className="mt-2 max-w-[60ch] text-body text-text-muted">
        {notFound
          ? "It may have expired, or the link is incomplete. Searches aren't kept forever because prices go stale."
          : error.message}
      </p>
      {error.requestId && error.kind !== "not_implemented" && error.kind !== "not_found" ? <p className="mt-2 text-caption text-text-muted">Support code {error.requestId}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {!notFound && error.retryable ? (
          <Button icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <ButtonLink href="/" variant={notFound ? "primary" : "ghost"} icon="search">
          New search
        </ButtonLink>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="mt-8" aria-label="Loading results">
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <Skeleton className="hidden h-96 rounded-lg lg:block" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-line bg-surface p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="ml-6 h-8 w-24" />
              </div>
              <Skeleton className="mt-4 h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading results</span>
    </div>
  );
}

function ProviderSummary({ data, onRerun, rerunning }: { data: Results; onRerun: (() => void) | null; rerunning: boolean }) {
  const failed = data.providers.filter((p) => p.status === "failed");
  const [open, setOpen] = useState(data.state === "failed");
  const tone = data.state === "failed" || (failed.length && !data.journeys.length) ? "danger" : failed.length ? "warn" : "neutral";
  const answered = data.providers.filter((p) => p.status === "complete").map((p) => p.label);
  const title =
    data.asked === 0
      ? "No connected source covers this search"
      : failed.length
        ? `${failed.map((p) => p.label).join(", ")} didn't answer`
        : `Answered by ${answered.join(", ") || "no source"}`;
  const subtitle =
    data.offerCount === 0 && data.journeys.length
      ? "Timetables only: real departures, no prices or seats yet."
      : data.offerCount
        ? `${plural(data.offerCount, "priced offer")}${data.timetableCount ? `, ${plural(data.timetableCount, "timetable result")}` : ""}.`
        : null;
  return (
    <section
      aria-label="Sources"
      className={cx(
        "mt-6 rounded-lg border p-4",
        tone === "neutral" ? "border-line bg-surface" : tone === "warn" ? "border-transparent bg-warn-wash" : "border-transparent bg-danger-wash",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Icon name={tone === "neutral" ? "info" : "alert"} size={20} className={tone === "neutral" ? "text-text-muted" : tone === "warn" ? "text-warn" : "text-danger"} />
        <p className="min-w-0 flex-1 basis-56">
          <span className="font-semibold">{title}.</span>
          {subtitle ? <span className="text-text-muted"> {subtitle}</span> : null}
        </p>
        {failed.length && onRerun ? (
          <Button variant="ghost" size="sm" icon="refresh" onClick={onRerun} loading={rerunning} disabled={rerunning}>
            Search again
          </Button>
        ) : null}
        <Button variant="quiet" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide sources" : "All sources"}
        </Button>
      </div>
      {open ? (
        <>
          <ul className="mt-3 divide-y divide-line/70 text-body-sm">
            {data.providers.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-40 font-semibold">{p.label}</span>
                <Badge tone={p.tone}>{p.statusLabel}</Badge>
                {p.message ? <span className="text-text-muted">{p.message}</span> : null}
              </li>
            ))}
          </ul>
          {data.warnings.length ? (
            <ul className="mt-2 space-y-1 text-body-sm text-text-muted">
              {data.warnings.map((w) => (
                <li key={w} className="flex gap-2">
                  <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

const TAB_KEYS: PickKey[] = ["cheapest", "fastest", "comfortable"];

function PickPanel({ pick }: { pick: ReturnType<typeof computePicks>[PickKey] }) {
  const trip = useTrip();
  const j = pick.journey;
  if (!j) return <p className="text-body-sm text-ink-muted">{pick.reason}</p>;
  const role = trip.roleOf(j.id);
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="max-w-[62ch]">
        <p className="tnum text-title">
          {j.departureLocal} → {j.arrivalLocal}
          <span className="text-ink-muted">
            {" "}
            · {formatDuration(j.durationMinutes)} · {j.price.display}
          </span>
        </p>
        <p className="mt-2 text-body-sm text-ink-muted">
          <span className="font-semibold text-white">Why this one: </span>
          {pick.reason}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <a
          href={`#journey-${j.id}`}
          className="inline-flex h-10 items-center rounded-md border border-ink-line px-4 text-label text-white no-underline hover:bg-ink-raised"
        >
          See it
        </a>
        <Button
          size="sm"
          variant="primary"
          icon={role ? "check" : "plus"}
          aria-pressed={!!role}
          onClick={() => (role ? trip.remove(j.id) : trip.add(j))}
        >
          {role === "option" ? "Saved option" : role ? "In trip" : "Add to trip"}
        </Button>
      </div>
    </div>
  );
}

/** Timetable-only results: no dead "Cheapest" tab, just two honest pointers. */
function PicksStrip({ journeys }: { journeys: Results["journeys"] }) {
  const picks = useMemo(() => computePicks(journeys), [journeys]);
  const items = (["fastest", "comfortable"] as PickKey[]).map((k) => picks[k]).filter((p) => p.journey);
  if (!items.length) return null;
  return (
    <section aria-label="Best picks" className="on-ink mt-6 rounded-lg bg-ink p-4 text-white sm:p-6">
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((p) => (
          <li key={p.key} className="min-w-0">
            <p className="text-label text-ink-muted">{p.key === "comfortable" ? "Fewest changes" : p.title}</p>
            <p className="tnum mt-1 text-title">
              <a href={`#journey-${p.journey!.id}`} aria-label={`${p.key === "comfortable" ? "Fewest changes" : p.title}: ${p.journey!.departureLocal} to ${p.journey!.arrivalLocal}, go to row`} className="text-white underline decoration-ink-line underline-offset-4 hover:decoration-lime">
                {p.journey!.departureLocal} → {p.journey!.arrivalLocal}
              </a>
              <span className="text-ink-muted"> · {p.headline === "Direct" ? "direct" : p.key === "fastest" ? p.headline : p.headline}</span>
            </p>
            <p className="mt-1 text-body-sm text-ink-muted">{p.reason}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-ink-line pt-3 text-caption text-ink-muted">
        No cheapest pick: timetable sources don&apos;t give prices.
      </p>
    </section>
  );
}

function Comparison({ journeys }: { journeys: Results["journeys"] }) {
  const picks = useMemo(() => computePicks(journeys), [journeys]);
  const [tab, setTab] = useState<PickKey>(picks.cheapest.journey ? "cheapest" : "fastest");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, i: number) {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? 2 : null;
    if (next === null) return;
    e.preventDefault();
    const k = (next + 3) % 3;
    setTab(TAB_KEYS[k]!);
    refs.current[k]?.focus();
  }

  return (
    <section aria-label="Best picks" className="mt-6 overflow-hidden rounded-lg bg-ink text-white on-ink">
      <div role="tablist" aria-label="Compare by" className="grid grid-cols-3 border-b border-ink-line">
        {TAB_KEYS.map((k, i) => {
          const p = picks[k];
          const selected = tab === k;
          return (
            <button
              key={k}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`tab-${k}`}
              aria-selected={selected}
              aria-controls={`panel-${k}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(k)}
              onKeyDown={(e) => onKey(e, i)}
              className={cx(
                "relative px-3 py-4 text-left transition-colors sm:px-6",
                selected ? "bg-ink-raised" : "hover:bg-ink-raised/60",
              )}
            >
              <span className={cx("block text-label", selected ? "text-white" : "text-ink-muted")}>{p.title}</span>
              <span className="tnum mt-1 block truncate font-display text-title sm:text-title-lg">{p.headline}</span>
              {selected ? <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-lime" /> : null}
            </button>
          );
        })}
      </div>
      {TAB_KEYS.map((k) => (
        <div key={k} role="tabpanel" id={`panel-${k}`} aria-labelledby={`tab-${k}`} tabIndex={0} hidden={tab !== k} className="p-4 sm:p-6">
          <PickPanel pick={picks[k]} />
        </div>
      ))}
    </section>
  );
}

function Loaded({ data, onRerun, rerunning }: { data: Results; onRerun: (() => void) | null; rerunning: boolean }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // With no prices, the honest default is a departure board.
  const [sort, setSort] = useState<SortKey>(data.offerCount ? "recommended" : "departure");
  const [showFilters, setShowFilters] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const currency = useMemo(() => dominantCurrency(data.journeys), [data.journeys]);
  const visible = useMemo(() => sortJourneys(applyFilters(data.journeys, filters), sort), [data.journeys, filters, sort]);
  const priced = visible.filter((j) => j.source === "offer");
  const timetable = visible.filter((j) => j.source === "timetable");
  const picks = useMemo(() => computePicks(data.journeys), [data.journeys]);
  const pickIds = (id: string) =>
    (Object.values(picks).filter((p) => p.journey?.id === id).map((p) => p.key) as PickKey[]);
  const stale = now - Date.parse(data.updatedAt) > STALE_AFTER_MS;
  const nFilters = activeFilterCount(filters);

  if (!data.journeys.length) {
    const failed = data.state === "failed";
    return (
      <>
        <ProviderSummary data={data} onRerun={onRerun} rerunning={rerunning} />
        <div className="mt-6 rounded-lg border border-dashed border-line-strong bg-surface p-6 md:p-10">
          <h2 className="font-display text-title-lg">
            {failed ? "No source could answer this search" : "Nothing found for this route and date"}
          </h2>
          <p className="mt-2 max-w-[60ch] text-body text-text-muted">
            {failed
              ? "That's a supplier problem, not a sign that no journeys exist. The details are above. Try again, or switch on other ways to travel."
              : "The sources that answered had no journeys here. Try a nearby city or station, another date, or more ways to travel. Public timetables currently cover Berlin and Brandenburg in detail."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/" icon="search">
              Change search
            </ButtonLink>
            {failed && onRerun ? (
              <Button variant="ghost" icon="refresh" onClick={onRerun} loading={rerunning}>
                Try again
              </Button>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ProviderSummary data={data} onRerun={onRerun} rerunning={rerunning} />
      {stale ? (
        <Notice
          tone="warn"
          title={`These results are from ${formatDateTime(data.updatedAt)}`}
          className="mt-4"
          action={
            onRerun ? (
              <Button variant="ghost" size="sm" icon="refresh" onClick={onRerun} loading={rerunning}>
                Refresh results
              </Button>
            ) : (
              <ButtonLink href="/" variant="ghost" size="sm" icon="search">
                New search
              </ButtonLink>
            )
          }
        >
          Prices, seats and timetables may have changed since. We&apos;ll recheck any offer before you pay.
        </Notice>
      ) : null}

      {data.offerCount ? <Comparison journeys={data.journeys} /> : <PicksStrip journeys={data.journeys} />}

      <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-lg border border-line bg-surface p-4">
            <FiltersPanel journeys={data.journeys} filters={filters} onChange={setFilters} currency={currency} />
          </div>
        </aside>
        <section aria-labelledby="list-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="list-title" className="text-title">
              {visible.length === data.journeys.length
                ? plural(visible.length, "journey")
                : `${visible.length} of ${plural(data.journeys.length, "journey")}`}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon="filter"
                className="lg:hidden"
                aria-expanded={showFilters}
                aria-controls="mobile-filters"
                onClick={() => setShowFilters((v) => !v)}
              >
                Filters{nFilters ? ` (${nFilters})` : ""}
              </Button>
              <label htmlFor="sort" className="text-label">
                Sort
              </label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-describedby="sort-explain"
                className="h-10 rounded-md border border-line-strong bg-surface px-3 text-label"
              >
                <option value="recommended">Recommended</option>
                <option value="departure">Departure time</option>
                <option value="price">Price</option>
                <option value="duration">Duration</option>
                <option value="changes">Fewest changes</option>
              </select>
            </div>
          </div>
          <div id="mobile-filters" hidden={!showFilters} className="mt-4 rounded-lg border border-line bg-surface p-4 lg:hidden">
            <FiltersPanel journeys={data.journeys} filters={filters} onChange={setFilters} currency={currency} />
          </div>
          <p id="sort-explain" className="mt-2 text-caption text-text-muted">
            {SORT_EXPLAIN[sort]}
            {sort === "price" && data.journeys.some((j) => !j.price.total) ? " Unknown prices sort last. They're not free." : ""}
          </p>
          {visible.length ? (
            <div className="mt-4 space-y-6">
              {priced.length ? (
                <ul className="space-y-4" aria-label="Priced offers">
                  {priced.map((j) => (
                    <li key={j.id}>
                      <JourneyCard journey={j} picks={pickIds(j.id)} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {timetable.length ? (
                <DepartureBoard
                  journeys={timetable}
                  picksFor={pickIds}
                  title={priced.length ? "Also running: timetables only" : "Departures"}
                  note="From public timetables. Real departures, no prices or seats yet."
                  footer={`Showing the first ${timetable.length} departures the timetable source returned (searches start at 08:00). Later departures need a time-of-day search, which our sources don't support yet.`}
                />
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-line-strong bg-surface p-6 text-center">
              <p className="font-semibold">No journeys match these filters</p>
              <p className="mt-1 text-body-sm text-text-muted">{plural(data.journeys.length, "journey")} hidden.</p>
              <Button variant="ghost" size="sm" className="mt-4" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </Button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
