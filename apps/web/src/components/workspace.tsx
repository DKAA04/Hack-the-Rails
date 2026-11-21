"use client";
import Link from "next/link";
import { SearchForm } from "../features/search/search-form";
import { useCapabilities } from "../features/search/use-capabilities";
import { providerLabel } from "../features/comparison/mappers/journey";
import { MODE_LABEL } from "../features/comparison/mappers/journey";
import { useTrip } from "../features/trip/store";
import { Icon } from "./icons";
import { Badge, Button, Skeleton, type Tone } from "./ui";

const SEARCH_TONE: Record<string, { label: string; tone: Tone }> = {
  available: { label: "Searching", tone: "ok" },
  unconfigured: { label: "Not configured", tone: "warn" },
  unverified: { label: "Unverified", tone: "warn" },
  unsupported: { label: "Not supported", tone: "neutral" },
  not_implemented: { label: "Not integrated yet", tone: "neutral" },
  unavailable: { label: "Down", tone: "danger" },
};

/** Home: search first, then a straight account of what's connected. */
export function Workspace() {
  const { state, retry } = useCapabilities();
  const { items, ready } = useTrip();

  return (
    <>
      <section className="pt-10 pb-8 md:pt-16 md:pb-10">
        <h1 className="max-w-[18ch] font-display text-[2.5rem] leading-[1.04] font-extrabold tracking-[-0.035em] md:text-display lg:text-[3.75rem]">
          Every way across Europe<span className="text-lime-deep">.</span>
        </h1>
        <p className="mt-4 max-w-[58ch] text-body text-text-muted md:text-title md:font-normal">
          Flights, trains, coaches and ferries, ranked on the same terms. We tell you what a price really is,
          who sells it, and how tight every connection gets.
        </p>
      </section>

      <SearchForm capabilities={state} />

      {ready && items.length ? (
        <section className="mt-8 flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="flex items-center gap-3">
            <Icon name="route" size={20} className="text-lime-deep" />
            <span>
              <strong>Your trip has {items.length} {items.length === 1 ? "journey" : "journeys"}.</strong>{" "}
              <span className="text-text-muted">Keep adding legs, or check it for conflicts.</span>
            </span>
          </p>
          <Link href="/trip" className="font-semibold underline">
            Open trip
          </Link>
        </section>
      ) : null}

      <section aria-labelledby="sources-title" className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 id="sources-title" className="font-display text-title-lg">
            What&apos;s connected right now
          </h2>
          <p className="mt-2 max-w-[48ch] text-body-sm text-text-muted">
            Having a key isn&apos;t the same as having a connection, and a timetable isn&apos;t a ticket. This is
            what can actually answer your search today.
          </p>
        </div>
        <div>
          {state.status === "loading" ? (
            <ul aria-label="Loading sources" className="divide-y divide-line rounded-lg border border-line bg-surface">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-24" />
                </li>
              ))}
            </ul>
          ) : state.status === "error" ? (
            <div role="alert" className="rounded-lg border border-line bg-surface p-4">
              <p className="font-semibold">{state.error.title}</p>
              <p className="mt-1 text-body-sm text-text-muted">
                We couldn&apos;t check which sources are connected. Search still works, but we can&apos;t tell you in
                advance who will answer.
              </p>
              <Button variant="ghost" size="sm" icon="refresh" className="mt-3" onClick={retry}>
                Check again
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              <li className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                <span className="w-32 font-semibold">Public timetables</span>
                <span className="flex-1 text-body-sm text-text-muted">Train, ferry, local · times only, no prices or seats</span>
                <Badge tone="info">Timetables</Badge>
              </li>
              {state.data.providers.map((p) => {
                const t = SEARCH_TONE[p.search] ?? { label: p.search, tone: "neutral" as Tone };
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                    <span className="w-32 font-semibold">{providerLabel(p.id)}</span>
                    <span className="flex-1 text-body-sm text-text-muted">
                      {p.modes.map((m) => MODE_LABEL[m]).join(", ")}
                    </span>
                    <Badge tone={t.tone}>{t.label}</Badge>
                  </li>
                );
              })}
              <li className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                <span className="w-32 font-semibold">Payments</span>
                <span className="flex-1 text-body-sm text-text-muted">Checkout and tickets</span>
                <Badge tone={state.data.paymentsConnected ? "ok" : "neutral"}>
                  {state.data.paymentsConnected ? "Available" : "Not available yet"}
                </Badge>
              </li>
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
