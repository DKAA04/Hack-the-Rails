"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/icons";
import { Button, Notice, cx } from "../../components/ui";
import { api } from "../../lib/api-client";
import { readDateField } from "../../lib/dom-date";
import { toErrorView, type ErrorView } from "../common/mappers/errors";
import type { PlaceSourceView } from "./mappers/places";
import {
  TOGGLE_MODES,
  fieldOrder,
  initialSearchState,
  toSearchIntent,
  todayIso,
  type FieldErrors,
  type SearchFormState,
  type TripType,
} from "./mappers/intent";
import { NaturalLanguageField, type ParseState } from "./natural-language";
import { PassengerEditor, passengerSummary } from "./passenger-editor";
import { PlaceCombobox, SourceList } from "./place-combobox";
import type { CapabilitiesState } from "./use-capabilities";

import { LAST_SEARCH_KEY as STORAGE_KEY, rememberSearchId } from "./rerun";

const FIELD_LABEL: Record<string, string> = {
  origin: "From",
  destination: "To",
  departureDate: "Departure date",
  returnDate: "Return date",
  modes: "Ways to travel",
  passengers: "Travellers",
  naturalLanguage: "Trip description",
  form: "Search",
};
function labelFor(key: string) {
  const m = key.match(/^passenger-(\d+)-(age|discount)/);
  if (m) return `Traveller ${Number(m[1]) + 1} ${m[2] === "age" ? "age" : "discount card"}`;
  return FIELD_LABEL[key] ?? key;
}

const TRIP_TYPES: { id: TripType; label: string }[] = [
  { id: "one_way", label: "One way" },
  { id: "return", label: "Return" },
  { id: "flexible", label: "Flexible dates" },
];

export function SearchForm({
  capabilities,
  initial,
  compact = false,
}: {
  capabilities: CapabilitiesState;
  /** When given (even null), the form starts from it instead of the session's last search. */
  initial?: SearchFormState | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [s, setS] = useState<SearchFormState>(() => (initial ? { ...initialSearchState(), ...initial } : initialSearchState()));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<ErrorView | null>(null);
  const [showTravellers, setShowTravellers] = useState(false);
  const [sources, setSources] = useState<PlaceSourceView[]>([]);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  // Move focus to the error summary after it renders (robust where rAF is throttled).
  useEffect(() => {
    if (failedSubmits) summaryRef.current?.focus();
  }, [failedSubmits]);
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (initial !== undefined) return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setS({ ...initialSearchState(), ...(JSON.parse(raw) as SearchFormState) });
    } catch {
      /* ignore corrupt drafts */
    }
  }, []);

  const set = <K extends keyof SearchFormState>(k: K, v: SearchFormState[K]) => {
    setS((x) => ({ ...x, [k]: v }));
    if (errors[k as string]) setErrors(({ [k as string]: _, ...rest }) => rest);
  };

  const caps = capabilities.status === "ready" ? capabilities.data : null;
  const parse: ParseState = caps
    ? caps.naturalLanguageConnected
      ? { status: "idle" }
      : {
          status: "not_connected",
          reason: "Reading trips from a sentence isn't connected yet.",
        }
    : {
        status: "not_connected",
        reason:
          capabilities.status === "loading"
            ? "Checking whether sentence reading is available."
            : "We couldn't check whether sentence reading is available.",
      };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFailure(null);
    // Adopt dates the field holds but React never heard about (autofill etc.).
    const dep = readDateField("departureDate");
    const ret = readDateField("returnDate");
    const current: SearchFormState = {
      ...s,
      departureDate: s.departureDate || dep.value,
      returnDate: s.returnDate || ret.value,
    };
    if (current.departureDate !== s.departureDate || current.returnDate !== s.returnDate) setS(current);
    const result = toSearchIntent(current);
    if (!result.ok) {
      const errs = { ...result.errors };
      if (errs.departureDate && !current.departureDate && dep.incomplete)
        errs.departureDate = "That date isn't complete. Check the day, month and year.";
      if (errs.returnDate && !current.returnDate && ret.incomplete)
        errs.returnDate = "That return date isn't complete. Check the day, month and year.";
      setErrors(errs);
      if (Object.keys(result.errors).some((k) => k.startsWith("passenger"))) setShowTravellers(true);
      setFailedSubmits((n) => n + 1);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      /* storage blocked */
    }
    try {
      const receipt = await api.search(result.intent);
      rememberSearchId(receipt.searchId);
      router.push(`/results/${encodeURIComponent(receipt.searchId)}`);
    } catch (err) {
      setFailure(toErrorView(err));
      setSubmitting(false);
    }
  }

  const ordered = fieldOrder(errors);
  const unsearchable = caps
    ? s.modes.filter((m) => !caps.modes[m].searchable)
    : [];

  return (
    <form onSubmit={submit} noValidate aria-labelledby="search-title" className={cx("rounded-lg bg-surface p-4 sm:p-6", compact ? "border border-line" : "shadow-lift lg:p-8")}>
      <h2 id="search-title" className="sr-only">
        Search journeys
      </h2>

      {ordered.length ? (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="mb-6 rounded-md border border-danger bg-danger-wash p-4 outline-none">
          <p className="flex items-center gap-2 font-semibold text-danger">
            <Icon name="alert" size={18} />
            {ordered.length === 1 ? "One thing to fix before we search" : `${ordered.length} things to fix before we search`}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-body-sm">
            {ordered.map((k) => (
              <li key={k}>
                <a href={`#${k}`} className="underline">
                  {labelFor(k)}: {errors[k]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset>
        <legend className="sr-only">Trip type</legend>
        <div className="inline-flex rounded-full border border-line-strong bg-paper p-1">
          {TRIP_TYPES.map((t) => (
            <label
              key={t.id}
              className={cx(
                "relative cursor-pointer rounded-full px-4 py-1.5 text-label transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
                s.tripType === t.id ? "bg-ink text-white" : "text-ink hover:bg-surface",
              )}
            >
              <input
                type="radio"
                name="tripType"
                value={t.id}
                checked={s.tripType === t.id}
                onChange={() => set("tripType", t.id)}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <PlaceCombobox
          id="origin"
          label="From"
          placeholder="City, airport, station or port"
          value={s.origin}
          onChange={(p) => set("origin", p)}
          onSources={setSources}
          error={errors.origin}
        />
        <div className="flex items-start justify-center lg:pt-7">
          <button
            type="button"
            onClick={() => setS((x) => ({ ...x, origin: x.destination, destination: x.origin }))}
            aria-label="Swap departure and destination"
            className="flex size-12 items-center justify-center rounded-full border border-line-strong bg-surface text-ink transition-colors hover:border-ink hover:bg-paper"
          >
            <Icon name="swap" size={20} className="lg:rotate-90" />
          </button>
        </div>
        <PlaceCombobox
          id="destination"
          label="To"
          placeholder="Where to?"
          value={s.destination}
          onChange={(p) => set("destination", p)}
          onSources={setSources}
          error={errors.destination}
        />
      </div>

      <div className={cx("mt-4 grid gap-4 sm:grid-cols-2", s.tripType === "return" && "lg:grid-cols-3")}>
        <DateField
          id="departureDate"
          label="Depart"
          value={s.departureDate}
          min={todayIso(s.origin?.timeZone)}
          onChange={(v) => set("departureDate", v)}
          error={errors.departureDate}
        />
        {s.tripType === "return" ? (
          <DateField
            id="returnDate"
            label="Return"
            value={s.returnDate}
            min={s.departureDate || todayIso(s.origin?.timeZone)}
            onChange={(v) => set("returnDate", v)}
            error={errors.returnDate}
          />
        ) : null}
        <div>
          <span className="mb-2 block text-label" id="travellers-label">
            Travellers and bags
          </span>
          <button
            type="button"
            aria-expanded={showTravellers}
            aria-controls="travellers-panel"
            aria-describedby="travellers-label"
            onClick={() => setShowTravellers((v) => !v)}
            className={cx(
              "flex h-12 w-full items-center gap-3 rounded-md border bg-surface px-4 text-left transition-colors hover:border-ink",
              Object.keys(errors).some((k) => k.startsWith("passenger")) ? "border-danger" : "border-line-strong",
            )}
          >
            <Icon name="users" size={18} className="text-text-muted" />
            <span className="tnum flex-1 truncate">{passengerSummary(s.passengers)}</span>
            <Icon name="chevron-down" size={18} className={cx("transition-transform", showTravellers && "rotate-180")} />
          </button>
        </div>
      </div>

      {s.tripType === "flexible" ? (
        <p className="mt-2 flex gap-2 text-caption text-text-muted">
          <Icon name="info" size={16} className="shrink-0" />
          Flexible-date comparison isn&apos;t connected yet, so we&apos;ll search your chosen date only.
        </p>
      ) : null}
      {s.tripType === "return" ? (
        <p className="mt-2 flex gap-2 text-caption text-text-muted">
          <Icon name="info" size={16} className="shrink-0" />
          Timetable sources only cover the outbound journey for now. Flight sellers can price both ways.
        </p>
      ) : null}

      <div id="travellers-panel" hidden={!showTravellers} className="mt-4">
        <PassengerEditor passengers={s.passengers} onChange={(ps) => set("passengers", ps)} errors={errors} />
      </div>

      <fieldset id="modes" tabIndex={-1} className="mt-6 outline-none" aria-describedby={errors.modes ? "modes-error" : "modes-hint"}>
        <legend className="mb-2 text-label">Ways to travel</legend>
        <div className="flex flex-wrap gap-2">
          {TOGGLE_MODES.map((m) => {
            const on = s.modes.includes(m.id);
            return (
              <label
                key={m.id}
                className={cx(
                  "flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-label transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                  on ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:border-ink",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() =>
                    set("modes", on ? s.modes.filter((x) => x !== m.id) : [...s.modes, m.id])
                  }
                />
                <Icon name={on ? "check" : m.id} size={16} />
                {m.label}
                {caps && !caps.modes[m.id].searchable ? (
                  <span className={cx("text-caption font-normal", on ? "text-ink-muted" : "text-text-muted")}>· no source yet</span>
                ) : null}
              </label>
            );
          })}
        </div>
        {errors.modes ? (
          <p id="modes-error" className="mt-2 text-caption font-semibold text-danger">
            {errors.modes}
          </p>
        ) : (
          <p id="modes-hint" className="mt-2 text-caption text-text-muted">
            {caps && unsearchable.length
              ? "Trains, ferries and local transit come from public timetables (Berlin and Brandenburg in detail), with no prices yet. Modes marked 'no source yet' won't return results."
              : "Every mode is ranked on the same terms. Nothing gets a head start."}
          </p>
        )}
      </fieldset>

      <details className="group mt-6">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-label">
          <Icon name="chevron-right" size={16} className="transition-transform group-open:rotate-90" />
          Preferences
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            id="pref-sort"
            label="What matters most"
            value={s.sort}
            onChange={(v) => set("sort", v as SearchFormState["sort"])}
            options={[
              ["cheapest", "Lowest total price"],
              ["fastest", "Shortest journey"],
              ["comfortable", "Fewest changes"],
            ]}
          />
          <SelectField
            id="pref-maxTransfers"
            label="Changes"
            value={s.maxTransfers}
            onChange={(v) => set("maxTransfers", v)}
            options={[
              ["", "Any number"],
              ["0", "Direct only"],
              ["1", "Up to 1"],
              ["2", "Up to 2"],
              ["3", "Up to 3"],
            ]}
          />
          <SelectField
            id="pref-cabin"
            label="Class"
            value={s.cabin}
            onChange={(v) => set("cabin", v as SearchFormState["cabin"])}
            options={[
              ["", "No preference"],
              ["economy", "Economy / 2nd"],
              ["premium", "Premium"],
              ["business", "Business"],
              ["first", "First"],
            ]}
          />
          <label className="flex h-12 items-center gap-3 self-end rounded-md border border-line-strong bg-surface px-4 text-body-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
            <input
              type="checkbox"
              checked={s.accessible}
              onChange={(e) => set("accessible", e.target.checked)}
              className="size-4 accent-ink"
            />
            Step-free access needed
          </label>
        </div>
        <p className="mt-2 text-caption text-text-muted">
          &ldquo;Fewest changes&rdquo; is how we rank comfort today. We don&apos;t have verified seat or crowding scores yet.
        </p>
      </details>

      <div className="mt-6 border-t border-line pt-6">
        <NaturalLanguageField
          value={s.naturalLanguage}
          onChange={(v) => set("naturalLanguage", v)}
          parse={parse}
          onParse={() => undefined}
          onApply={() => undefined}
          error={errors.naturalLanguage}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-between">
        <Button type="submit" iconAfter="arrow-right" loading={submitting} disabled={submitting} className="w-full shrink-0 sm:w-auto">
          {submitting ? "Searching…" : "Find journeys"}
        </Button>
        <div className="min-w-0 text-caption text-text-muted">
          {sources.length ? (
            <>
              <span className="mb-1 block">Place data</span>
              <SourceList sources={sources} />
            </>
          ) : (
            <span>We only search places you pick from the list, so suppliers get exact IDs.</span>
          )}
        </div>
      </div>

      <div aria-live="polite" className="mt-4 empty:hidden">
        {submitting ? (
          <p className="text-body-sm text-text-muted">
            Asking every connected source at once. This can take up to 10 seconds.
          </p>
        ) : null}
        {failure ? (
          <Notice
            tone="danger"
            role="alert"
            title={failure.title}
            action={
              failure.retryable ? (
                <Button type="submit" variant="ghost" size="sm" icon="refresh">
                  Try again
                </Button>
              ) : null
            }
          >
            {failure.message}
            {failure.requestId && failure.kind === "unknown" ? (
              <span className="mt-1 block text-caption">Support code {failure.requestId}</span>
            ) : null}
          </Notice>
        ) : null}
      </div>
    </form>
  );
}

function DateField({
  id,
  label,
  value,
  min,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  min: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-label">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cx(
          "tnum h-12 w-full rounded-md border bg-surface px-4 text-body focus:border-ink",
          error ? "border-danger" : "border-line-strong",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-caption font-semibold text-danger">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-label">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-md border border-line-strong bg-surface px-3 text-body focus:border-ink"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

