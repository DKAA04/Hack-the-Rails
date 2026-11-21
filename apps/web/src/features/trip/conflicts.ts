import { formatDuration, formatMoney, minutesBetween, type MoneyValue } from "../../lib/format";
import type { JourneyView } from "../comparison/mappers/journey";

export type ConflictKind = "overlap" | "out_of_order" | "location_gap" | "tight_gap" | "not_bookable";
export interface Conflict {
  kind: ConflictKind;
  severity: "danger" | "warn";
  between: [string, string] | [string];
  message: string;
}

const short = (j: JourneyView) => `${j.origin.name} → ${j.destination.name}`;

export function findConflicts(items: JourneyView[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i]!;
    const b = items[i + 1]!;
    const gap = minutesBetween(a.arrivalUtc, b.departureUtc);
    if (Date.parse(b.departureUtc) < Date.parse(a.departureUtc)) {
      out.push({
        kind: "out_of_order",
        severity: "warn",
        between: [a.id, b.id],
        message: `${short(b)} leaves before ${short(a)}. Reorder the trip or sort by departure.`,
      });
      continue;
    }
    if (gap < 0) {
      out.push({
        kind: "overlap",
        severity: "danger",
        between: [a.id, b.id],
        message: `Impossible connection: ${short(b)} leaves at ${b.departureLocal}, ${formatDuration(-gap)} before ${short(a)} arrives at ${a.arrivalLocal}.`,
      });
      continue;
    }
    if (a.destination.id !== b.origin.id) {
      out.push({
        kind: "location_gap",
        severity: "warn",
        between: [a.id, b.id],
        message: `You arrive at ${a.destination.name} but the next leg leaves from ${b.origin.name}, ${formatDuration(gap)} later. Wayward hasn't planned how you get between them.`,
      });
    } else if (gap < 30) {
      out.push({
        kind: "tight_gap",
        severity: "warn",
        between: [a.id, b.id],
        message: `Only ${formatDuration(gap)} to connect at ${a.destination.name}. These are separate bookings, so a delay on the first isn't covered by the second.`,
      });
    }
  }
  for (const j of items)
    if (!j.bookable)
      out.push({
        kind: "not_bookable",
        severity: "warn",
        between: [j.id],
        message: `${short(j)}: ${j.notBookableReason ?? "not bookable"}`,
      });
  return out;
}

export interface TripTotal {
  /** Integer sums per currency; never converted between currencies. */
  known: MoneyValue[];
  knownDisplay: string;
  unknownCount: number;
  partialCount: number;
  complete: boolean;
}

export function tripTotal(items: JourneyView[]): TripTotal {
  const sums = new Map<string, number>();
  let unknownCount = 0;
  let partialCount = 0;
  for (const j of items) {
    const t = j.price.total;
    if (!t) {
      unknownCount++;
      continue;
    }
    if (j.price.completeness !== "complete") partialCount++;
    sums.set(t.currency, (sums.get(t.currency) ?? 0) + t.amount);
  }
  const known = [...sums.entries()].map(([currency, amount]) => ({ amount, currency }));
  return {
    known,
    knownDisplay: known.length ? known.map((m) => formatMoney(m)).join(" + ") : "Unknown",
    unknownCount,
    partialCount,
    complete: items.length > 0 && unknownCount === 0 && partialCount === 0 && known.length === 1,
  };
}
