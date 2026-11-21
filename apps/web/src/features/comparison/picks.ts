import { formatDuration, formatMoney, plural } from "../../lib/format";
import { MODE_LABEL, type JourneyView } from "./mappers/journey";

export type PickKey = "cheapest" | "fastest" | "comfortable";
export interface Pick {
  key: PickKey;
  title: string;
  journey: JourneyView | null;
  headline: string;
  reason: string;
}

export const PICK_TITLE: Record<PickKey, string> = {
  cheapest: "Cheapest",
  fastest: "Fastest",
  comfortable: "Most comfortable",
};

const modeNoun = (j: JourneyView) => MODE_LABEL[j.mainMode].toLowerCase();

/** The currency most comparable prices are quoted in; never converts FX. */
export function dominantCurrency(journeys: JourneyView[]) {
  const counts = new Map<string, number>();
  for (const j of journeys)
    if (j.price.comparable && j.price.total)
      counts.set(
        j.price.total.currency,
        (counts.get(j.price.total.currency) ?? 0) + 1,
      );
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function byDuration(a: JourneyView, b: JourneyView) {
  return a.durationMinutes - b.durationMinutes || a.changes - b.changes;
}

export function computePicks(journeys: JourneyView[]): Record<PickKey, Pick> {
  const currency = dominantCurrency(journeys);
  const priced = journeys.filter(
    (j) => j.price.comparable && j.price.total?.currency === currency,
  );
  const cheapest =
    [...priced].sort(
      (a, b) => a.price.total!.amount - b.price.total!.amount || byDuration(a, b),
    )[0] ?? null;
  const fastest = [...journeys].sort(byDuration)[0] ?? null;
  const comfortable =
    [...journeys].sort(
      (a, b) =>
        a.changes - b.changes ||
        Number(a.overnight) - Number(b.overnight) ||
        byDuration(a, b),
    )[0] ?? null;

  return {
    cheapest: {
      key: "cheapest",
      title: PICK_TITLE.cheapest,
      journey: cheapest,
      headline: cheapest ? cheapest.price.display : "No prices",
      reason: cheapest
        ? cheapestReason(cheapest, fastest)
        : journeys.length
          ? "None of these results has a complete, bookable price yet. Timetable results don't come with prices."
          : "No results yet.",
    },
    fastest: {
      key: "fastest",
      title: PICK_TITLE.fastest,
      journey: fastest,
      headline: fastest ? formatDuration(fastest.durationMinutes) : "None",
      reason: fastest ? fastestReason(fastest, cheapest) : "No results yet.",
    },
    comfortable: {
      key: "comfortable",
      title: PICK_TITLE.comfortable,
      journey: comfortable,
      headline: comfortable
        ? comfortable.changes === 0
          ? "Direct"
          : plural(comfortable.changes, "change")
        : "None",
      reason: comfortable
        ? comfortableReason(comfortable, fastest)
        : "No results yet.",
    },
  };
}

function cheapestReason(c: JourneyView, f: JourneyView | null) {
  if (!f || f.id === c.id)
    return "Lowest complete price, and it's also the fastest. Easy call.";
  const slower = c.durationMinutes - f.durationMinutes;
  let s =
    slower > 0
      ? `Lowest complete price. It's ${formatDuration(slower)} slower than the fastest`
      : "Lowest complete price";
  if (c.mainMode !== f.mainMode)
    s += `, and it's a ${modeNoun(c)}, not a ${modeNoun(f)}`;
  s += ".";
  if (c.overnight) s += " Overnight travel.";
  return s;
}

function fastestReason(f: JourneyView, c: JourneyView | null) {
  let s = `Shortest door-to-door time: ${formatDuration(f.durationMinutes)}`;
  s += f.changes === 0 ? ", direct." : ` with ${plural(f.changes, "change")}.`;
  if (!f.price.comparable)
    s +=
      f.price.kind === "unknown"
        ? " Price unknown: it's a timetable result, not an offer."
        : ` Price is ${f.price.kindLabel.toLowerCase()}, not a confirmed total.`;
  else if (c && c.id !== f.id && c.price.total && f.price.total)
    s += ` Costs ${formatMoney({ amount: f.price.total.amount - c.price.total.amount, currency: f.price.total.currency })} more than the cheapest.`;
  if (f.worstTransfer === "tight") s += " One connection is tight.";
  if (f.worstTransfer === "impossible")
    s += " Warning: a connection can't be made as scheduled.";
  return s;
}

function comfortableReason(m: JourneyView, f: JourneyView | null) {
  let s =
    m.changes === 0
      ? "No changes at all."
      : `Fewest changes: ${plural(m.changes, "change")}`;
  if (m.changes > 0 && f && f.id !== m.id && f.changes > m.changes)
    s += `, versus ${f.changes} on the fastest.`;
  else if (m.changes > 0) s += ".";
  if (m.overnight) s += " Includes overnight travel.";
  s +=
    " Comfort here means fewest changes. We don't have seat or crowding scores yet.";
  return s;
}
