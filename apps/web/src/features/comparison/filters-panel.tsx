"use client";
import { Button } from "../../components/ui";
import { formatMoney, minorDigits } from "../../lib/format";
import { MODE_LABEL, type JourneyView, type ModeKey } from "./mappers/journey";
import {
  EMPTY_FILTERS,
  TIMETABLE_SELLER,
  WINDOWS,
  activeFilterCount,
  sellerKey,
  type Filters,
} from "./filters";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <legend className="mb-2 float-left w-full text-label">{title}</legend>
      <div className="clear-left space-y-1.5">{children}</div>
    </fieldset>
  );
}

function Check({
  label,
  checked,
  onChange,
  count,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-sm text-body-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-ink" />
      <span className="flex-1">{label}</span>
      {count !== undefined ? <span className="tnum text-caption text-text-muted">{count}</span> : null}
    </label>
  );
}

const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

export function FiltersPanel({
  journeys,
  filters,
  onChange,
  currency,
}: {
  journeys: JourneyView[];
  filters: Filters;
  onChange: (f: Filters) => void;
  currency: string | null;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const modes = [...new Set(journeys.flatMap((j) => j.modes))].filter(
    (m): m is ModeKey => m !== "walking" && m !== "transfer",
  );
  const sellers = new Map<string, { label: string; count: number }>();
  for (const j of journeys) {
    const k = sellerKey(j);
    const prev = sellers.get(k);
    sellers.set(k, {
      label: j.seller?.name ?? "Timetable only (no seller)",
      count: (prev?.count ?? 0) + 1,
    });
  }
  const unknownPrices = journeys.filter((j) => !j.price.total).length;
  const digits = currency ? minorDigits(currency) : 2;
  const count = activeFilterCount(filters);

  return (
    <div className="text-ink">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-title">Filters</h2>
        {count ? (
          <Button variant="quiet" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear {count}
          </Button>
        ) : null}
      </div>

      {modes.length > 1 ? (
        <Group title="Mode">
          {modes.map((m) => (
            <Check
              key={m}
              label={MODE_LABEL[m]}
              checked={filters.modes.includes(m)}
              onChange={(on) => set({ modes: toggle(filters.modes, m, on) })}
              count={journeys.filter((j) => j.modes.includes(m)).length}
            />
          ))}
        </Group>
      ) : null}

      <Group title="Price">
        {currency ? (
          <div>
            <label htmlFor="maxPrice" className="text-body-sm">
              Up to ({currency})
            </label>
            <input
              id="maxPrice"
              inputMode="numeric"
              placeholder="Any"
              value={filters.maxPrice === null ? "" : String(filters.maxPrice / 10 ** digits)}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                set({ maxPrice: v ? Number(v) * 10 ** digits : null });
              }}
              aria-describedby="maxPrice-hint"
              className="tnum mt-1 h-10 w-full rounded-md border border-line-strong bg-surface px-3"
            />
            <p id="maxPrice-hint" className="mt-1 text-caption text-text-muted">
              {filters.maxPrice !== null
                ? `Known totals up to ${formatMoney({ amount: filters.maxPrice, currency }, { compact: true })}.`
                : "Applies to known totals only."}
            </p>
          </div>
        ) : (
          <p className="text-body-sm text-text-muted">No known prices to filter by.</p>
        )}
        {unknownPrices ? (
          <Check
            label="Hide unknown prices"
            checked={filters.hideUnknownPrice}
            onChange={(v) => set({ hideUnknownPrice: v })}
            count={unknownPrices}
          />
        ) : null}
        <Check label="Bookable offers only" checked={filters.bookableOnly} onChange={(v) => set({ bookableOnly: v })} />
      </Group>

      <Group title="Journey">
        <label htmlFor="maxDuration" className="block text-body-sm">
          Longest journey
        </label>
        <select
          id="maxDuration"
          value={filters.maxDurationMinutes ?? ""}
          onChange={(e) => set({ maxDurationMinutes: e.target.value ? Number(e.target.value) : null })}
          className="h-10 w-full rounded-md border border-line-strong bg-surface px-2"
        >
          <option value="">Any length</option>
          {[2, 4, 6, 8, 12, 24].map((h) => (
            <option key={h} value={h * 60}>
              Up to {h}h
            </option>
          ))}
        </select>
        <label htmlFor="maxChanges" className="mt-3 block text-body-sm">
          Changes
        </label>
        <select
          id="maxChanges"
          value={filters.maxChanges ?? ""}
          onChange={(e) => set({ maxChanges: e.target.value === "" ? null : Number(e.target.value) })}
          className="h-10 w-full rounded-md border border-line-strong bg-surface px-2"
        >
          <option value="">Any number</option>
          <option value="0">Direct only</option>
          <option value="1">Up to 1</option>
          <option value="2">Up to 2</option>
        </select>
        <div className="pt-2">
          <Check label="Avoid overnight travel" checked={filters.avoidOvernight} onChange={(v) => set({ avoidOvernight: v })} />
        </div>
      </Group>

      <Group title="Departure time">
        {WINDOWS.map((w) => (
          <Check
            key={w.id}
            label={w.label}
            checked={filters.windows.includes(w.id)}
            onChange={(on) => set({ windows: toggle(filters.windows, w.id, on) })}
            count={journeys.filter((j) => j.departureHour >= w.from && j.departureHour < w.to).length}
          />
        ))}
      </Group>

      <Group title="Baggage">
        <Check
          label="Checked bag included"
          checked={filters.checkedBagIncluded}
          onChange={(v) => set({ checkedBagIncluded: v })}
          count={journeys.filter((j) => (j.baggage.checked ?? 0) > 0).length}
        />
        <p className="text-caption text-text-muted">Only counts sellers that say so. Unknown isn&apos;t included.</p>
      </Group>

      {sellers.size > 1 ? (
        <Group title="Seller">
          {[...sellers.entries()].map(([k, s]) => (
            <Check
              key={k}
              label={s.label}
              checked={filters.sellers.includes(k)}
              onChange={(on) => set({ sellers: toggle(filters.sellers, k, on) })}
              count={s.count}
            />
          ))}
        </Group>
      ) : sellers.size === 1 ? (
        <Group title="Seller">
          <p className="text-body-sm text-text-muted">
            {sellers.has(TIMETABLE_SELLER) ? "No sellers yet: timetable results only." : `All from ${[...sellers.values()][0]!.label}.`}
          </p>
        </Group>
      ) : null}
    </div>
  );
}
