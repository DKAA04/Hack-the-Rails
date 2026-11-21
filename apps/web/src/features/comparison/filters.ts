import type { JourneyView, ModeKey } from "./mappers/journey";

export type DepartureWindow = "night" | "morning" | "afternoon" | "evening";
export const WINDOWS: { id: DepartureWindow; label: string; from: number; to: number }[] = [
  { id: "night", label: "Night 00–06", from: 0, to: 6 },
  { id: "morning", label: "Morning 06–12", from: 6, to: 12 },
  { id: "afternoon", label: "Afternoon 12–18", from: 12, to: 18 },
  { id: "evening", label: "Evening 18–24", from: 18, to: 24 },
];

export type SortKey = "recommended" | "price" | "duration" | "departure" | "changes";

export interface Filters {
  modes: ModeKey[]; // empty = all
  maxPrice: number | null; // minor units, applies to known totals only
  hideUnknownPrice: boolean;
  maxDurationMinutes: number | null;
  maxChanges: number | null;
  windows: DepartureWindow[]; // empty = all
  checkedBagIncluded: boolean;
  sellers: string[]; // empty = all; "timetable" key for timetable-only
  bookableOnly: boolean;
  avoidOvernight: boolean;
}

export const EMPTY_FILTERS: Filters = {
  modes: [],
  maxPrice: null,
  hideUnknownPrice: false,
  maxDurationMinutes: null,
  maxChanges: null,
  windows: [],
  checkedBagIncluded: false,
  sellers: [],
  bookableOnly: false,
  avoidOvernight: false,
};

export const TIMETABLE_SELLER = "__timetable__";
export function sellerKey(j: JourneyView) {
  return j.seller?.id ?? TIMETABLE_SELLER;
}

export function activeFilterCount(f: Filters) {
  return (
    (f.modes.length ? 1 : 0) +
    (f.maxPrice !== null ? 1 : 0) +
    (f.hideUnknownPrice ? 1 : 0) +
    (f.maxDurationMinutes !== null ? 1 : 0) +
    (f.maxChanges !== null ? 1 : 0) +
    (f.windows.length ? 1 : 0) +
    (f.checkedBagIncluded ? 1 : 0) +
    (f.sellers.length ? 1 : 0) +
    (f.bookableOnly ? 1 : 0) +
    (f.avoidOvernight ? 1 : 0)
  );
}

export function applyFilters(journeys: JourneyView[], f: Filters) {
  return journeys.filter((j) => {
    if (f.modes.length && !j.modes.some((m) => f.modes.includes(m))) return false;
    if (f.hideUnknownPrice && !j.price.total) return false;
    if (f.maxPrice !== null && j.price.total && j.price.total.amount > f.maxPrice)
      return false;
    if (f.maxDurationMinutes !== null && j.durationMinutes > f.maxDurationMinutes)
      return false;
    if (f.maxChanges !== null && j.changes > f.maxChanges) return false;
    if (
      f.windows.length &&
      !WINDOWS.some(
        (w) =>
          f.windows.includes(w.id) &&
          j.departureHour >= w.from &&
          j.departureHour < w.to,
      )
    )
      return false;
    // Unknown baggage is not "included": only explicit checked bags count.
    if (f.checkedBagIncluded && !(j.baggage.checked && j.baggage.checked > 0))
      return false;
    if (f.sellers.length && !f.sellers.includes(sellerKey(j))) return false;
    if (f.bookableOnly && !j.bookable) return false;
    if (f.avoidOvernight && j.overnight) return false;
    return true;
  });
}

/** Unknown prices always sort after known ones; never treated as zero. */
export function sortJourneys(journeys: JourneyView[], key: SortKey) {
  const list = [...journeys];
  const price = (j: JourneyView) => j.price.total?.amount ?? Number.POSITIVE_INFINITY;
  switch (key) {
    case "price":
      return list.sort(
        (a, b) => price(a) - price(b) || a.durationMinutes - b.durationMinutes,
      );
    case "duration":
      return list.sort((a, b) => a.durationMinutes - b.durationMinutes);
    case "departure":
      return list.sort((a, b) => Date.parse(a.departureUtc) - Date.parse(b.departureUtc));
    case "changes":
      return list.sort(
        (a, b) => a.changes - b.changes || a.durationMinutes - b.durationMinutes,
      );
    default:
      // Recommended: bookable first, then fewer risky transfers, then duration.
      return list.sort(
        (a, b) =>
          Number(b.bookable) - Number(a.bookable) ||
          Number(a.worstTransfer === "impossible") -
            Number(b.worstTransfer === "impossible") ||
          price(a) - price(b) ||
          a.durationMinutes - b.durationMinutes,
      );
  }
}
