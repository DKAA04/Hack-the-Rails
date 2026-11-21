"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../../components/icons";
import { Badge, Button, ButtonLink, Notice, Skeleton, cx } from "../../components/ui";
import { api } from "../../lib/api-client";
import { formatDateTime, formatDuration, plural } from "../../lib/format";
import { isAbort, toErrorView, type ErrorView } from "../common/mappers/errors";
import { readLastSearch, rerunLastSearch } from "../search/rerun";
import { useTrip } from "../trip/store";
import { EMPTY_FILTERS, activeFilterCount, applyFilters, sortJourneys, type Filters, type SortKey } from "./filters";
import { FiltersPanel } from "./filters-panel";
import { JourneyCard } from "./journey-card";
import { toResultsView, type ResultsView as Results } from "./mappers/journey";
import { computePicks, dominantCurrency, type PickKey } from "./picks";

const STALE_AFTER_MS = 15 * 60_000;

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
    const last = readLastSearch();
    if (last?.origin && last.destination) setRoute(`${last.origin.name} to ${last.destination.name}`);
    return () => ac.abort();
  }, [fetchResults]);

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
        <div>
          <Link href="/" className="inline-flex items-center gap-1 text-body-sm text-text-muted underline-offset-4 hover:underline">
            <Icon name="arrow-right" size={14} className="rotate-180" />
            Edit search
          </Link>
          <h1 className="mt-2 font-display text-headline">{title}</h1>
        </div>
        {load.status === "ready" ? (
          <Button variant="ghost" size="sm" icon="refresh" onClick={rerun} loading={rerunning} disabled={rerunning}>
            Search again
          </Button>
        ) : null}
      </div>
      {rerunError ? (
        <Notice tone="danger" role="alert" title={rerunError.title} className="mt-4">
          {rerunError.message}
        </Notice>
      ) : null}

      <div aria-live="polite" aria-busy={load.status === "loading"}>
        {load.status === "loading" ? <ResultsSkeleton /> : null}
        {load.status === "error" ? (
          <ErrorState error={load.error} onRetry={() => fetchResults()} />
        ) : null}
        {load.status === "ready" ? <Loaded data={load.data} onRerun={rerun} rerunning={rerunning} /> : null}
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
      {error.requestId ? <p className="mt-2 text-caption text-text-muted">Reference {error.requestId}</p> : null}
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

function ProviderSummary({ data, onRerun, rerunning }: { data: Results; onRerun: () => void; rerunning: boolean }) {
  const [open, setOpen] = useState(data.state === "failed");
  const failed = data.providers.filter((p) => p.status === "failed" || p.status === "unconfigured");
  const tone = data.state === "failed" ? "danger" : data.state === "partial" ? "warn" : "ok";
  const title =
    data.asked === 0
      ? "No connected source covers this search"
      : `${data.answered} of ${plural(data.asked, "source")} answered`;
  return (
    <section aria-label="Sources" className={cx("mt-6 rounded-lg border p-4", tone === "ok" ? "border-line bg-surface" : tone === "warn" ? "border-transparent bg-warn-wash" : "border-transparent bg-danger-wash")}>
      <div className="flex flex-wrap items-center gap-3">
        <Icon name={tone === "ok" ? "check" : "alert"} size={20} className={tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-danger"} />
        <p className="flex-1 font-semibold">
          {title}
          {data.notIntegrated ? (
            <span className="font-normal text-text-muted"> · {data.notIntegrated} more not integrated yet</span>
          ) : null}
        </p>
        {failed.length ? (
          <Button variant="ghost" size="sm" icon="refresh" onClick={onRerun} loading={rerunning} disabled={rerunning}>
            Retry
          </Button>
        ) : null}
        <Button variant="quiet" size="sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Hide sources" : "Show sources"}
        </Button>
      </div>
      {open ? (
        <ul className="mt-3 divide-y divide-line/70 text-body-sm">
          {data.providers.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="w-40 font-semibold">{p.label}</span>
              <Badge tone={p.tone}>{p.statusLabel}</Badge>
              {p.message ? <span className="text-text-muted">{p.message}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {open && data.warnings.length ? (
        <ul className="mt-2 space-y-1 text-body-sm text-text-muted">
          {data.warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <Icon name="info" size={16} className="mt-0.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const TAB_KEYS: PickKey[] = ["cheapest", "fastest", "comfortable"];

function Comparison({ journeys }: { journeys: Results["journeys"] }) {
  const picks = useMemo(() => computePicks(journeys), [journeys]);
  const [tab, setTab] = useState<PickKey>(picks.cheapest.journey ? "cheapest" : "fastest");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const trip = useTrip();
  const pick = picks[tab];

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
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="p-4 sm:p-6">
        {pick.journey ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[62ch]">
              <p className="tnum text-title">
                {pick.journey.departureLocal} → {pick.journey.arrivalLocal}
                <span className="text-ink-muted">
                  {" "}
                  · {formatDuration(pick.journey.durationMinutes)} · {pick.journey.price.display}
                </span>
              </p>
              <p className="mt-2 text-body-sm text-ink-muted">
                <span className="font-semibold text-white">Why this one: </span>
                {pick.reason}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={`#journey-${pick.journey.id}`}
                className="inline-flex h-10 items-center rounded-md border border-ink-line px-4 text-label text-white no-underline hover:bg-ink-raised"
              >
                See it
              </a>
              <Button
                size="sm"
                variant="primary"
                icon={trip.has(pick.journey.id) ? "check" : "plus"}
                aria-pressed={trip.has(pick.journey.id)}
                onClick={() => (trip.has(pick.journey!.id) ? trip.remove(pick.journey!.id) : trip.add(pick.journey!))}
              >
                {trip.has(pick.journey.id) ? "In trip" : "Add to trip"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-body-sm text-ink-muted">{pick.reason}</p>
        )}
      </div>
    </section>
  );
}

function Loaded({ data, onRerun, rerunning }: { data: Results; onRerun: () => void; rerunning: boolean }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [showFilters, setShowFilters] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const currency = useMemo(() => dominantCurrency(data.journeys), [data.journeys]);
  const visible = useMemo(() => sortJourneys(applyFilters(data.journeys, filters), sort), [data.journeys, filters, sort]);
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
            {failed ? (
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
            <Button variant="ghost" size="sm" icon="refresh" onClick={onRerun} loading={rerunning}>
              Refresh results
            </Button>
          }
        >
          Prices, seats and timetables may have changed since. We&apos;ll recheck any offer before you pay.
        </Notice>
      ) : null}
      {data.offerCount === 0 ? (
        <Notice tone="info" title="Timetables only, no prices yet" className="mt-4">
          {data.timetableCount} {data.timetableCount === 1 ? "journey comes" : "journeys come"} from public timetables. They show
          real departures, but no seller has offered seats or a price, so you can plan with them, not book them.
        </Notice>
      ) : null}

      <Comparison journeys={data.journeys} />

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
              <label htmlFor="sort" className="sr-only">
                Sort by
              </label>
              <select
                id="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-10 rounded-md border border-line-strong bg-surface px-3 text-label"
              >
                <option value="recommended">Sort: recommended</option>
                <option value="price">Sort: price</option>
                <option value="duration">Sort: duration</option>
                <option value="departure">Sort: departure time</option>
                <option value="changes">Sort: fewest changes</option>
              </select>
            </div>
          </div>
          <div id="mobile-filters" hidden={!showFilters} className="mt-4 rounded-lg border border-line bg-surface p-4 lg:hidden">
            <FiltersPanel journeys={data.journeys} filters={filters} onChange={setFilters} currency={currency} />
          </div>
          {sort === "price" && data.journeys.some((j) => !j.price.total) ? (
            <p className="mt-2 text-caption text-text-muted">Unknown prices sort last. They&apos;re not free.</p>
          ) : null}
          {visible.length ? (
            <ul className="mt-4 space-y-4">
              {visible.map((j) => (
                <li key={j.id}>
                  <JourneyCard journey={j} picks={pickIds(j.id)} />
                </li>
              ))}
            </ul>
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
