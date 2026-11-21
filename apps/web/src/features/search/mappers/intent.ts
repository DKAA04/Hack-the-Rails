import {
  SearchIntentSchema,
  type Mode,
  type SearchIntent,
} from "@wayward/contracts";
import type { PlaceOption } from "./places";

export type TripType = "one_way" | "return" | "flexible";
export type SortPreference = "cheapest" | "fastest" | "comfortable";
export type CabinPreference = "" | "economy" | "premium" | "business" | "first";

/** The five modes a traveller toggles. Walking/transfer are connective. */
export const TOGGLE_MODES: { id: Mode; label: string }[] = [
  { id: "flight", label: "Flights" },
  { id: "rail", label: "Trains" },
  { id: "coach", label: "Coaches" },
  { id: "ferry", label: "Ferries" },
  { id: "local_transit", label: "Local" },
];

export interface DiscountDraft {
  key: string;
  scheme: string;
  cardReference: string;
}
export interface PassengerDraft {
  key: string;
  age: string;
  cabinBags: number;
  checkedBags: number;
  bicycles: number;
  discounts: DiscountDraft[];
}
export interface SearchFormState {
  tripType: TripType;
  origin: PlaceOption | null;
  destination: PlaceOption | null;
  departureDate: string;
  returnDate: string;
  passengers: PassengerDraft[];
  modes: Mode[];
  sort: SortPreference;
  maxTransfers: string;
  accessible: boolean;
  cabin: CabinPreference;
  naturalLanguage: string;
}

export type FieldErrors = Record<string, string>;

export function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k${Math.random().toString(36).slice(2)}`;
}

export function newPassenger(age = ""): PassengerDraft {
  return { key: newKey(), age, cabinBags: 1, checkedBags: 0, bicycles: 0, discounts: [] };
}

export function initialSearchState(): SearchFormState {
  return {
    tripType: "one_way",
    origin: null,
    destination: null,
    departureDate: "",
    returnDate: "",
    passengers: [newPassenger("30")],
    modes: TOGGLE_MODES.map((m) => m.id),
    sort: "cheapest",
    maxTransfers: "",
    accessible: false,
    cabin: "",
    naturalLanguage: "",
  };
}

export function todayIso(timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date());
}

/** Validates the form and builds a contract SearchIntent, or field errors. */
export function toSearchIntent(
  s: SearchFormState,
): { ok: true; intent: SearchIntent } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  if (!s.origin) errors.origin = "Choose a departure place from the list.";
  if (!s.destination) errors.destination = "Choose a destination from the list.";
  if (s.origin && s.destination && s.origin.id === s.destination.id)
    errors.destination = "Destination is the same as the departure place.";
  const today = todayIso(s.origin?.timeZone);
  if (!s.departureDate) errors.departureDate = "Pick a departure date.";
  else if (s.departureDate < today)
    errors.departureDate = "That date has already passed at your departure place.";
  if (s.tripType === "return") {
    if (!s.returnDate) errors.returnDate = "Pick a return date, or switch to one way.";
    else if (s.departureDate && s.returnDate < s.departureDate)
      errors.returnDate = "Return is before departure.";
  }
  if (!s.modes.length) errors.modes = "Keep at least one way to travel switched on.";
  if (!s.passengers.length) errors.passengers = "Add at least one traveller.";
  if (s.passengers.length > 20) errors.passengers = "Up to 20 travellers per search.";
  s.passengers.forEach((p, i) => {
    const age = Number(p.age);
    if (p.age.trim() === "" || !Number.isInteger(age) || age < 0 || age > 120)
      errors[`passenger-${i}-age`] = "Enter an age from 0 to 120.";
    p.discounts.forEach((d, j) => {
      if (!d.scheme.trim())
        errors[`passenger-${i}-discount-${j}`] = "Name the card or scheme, or remove it.";
    });
  });
  if (s.naturalLanguage.length > 4000)
    errors.naturalLanguage = "Keep it under 4,000 characters.";
  if (Object.keys(errors).length) return { ok: false, errors };

  const modes = new Set<Mode>(s.modes);
  if (modes.has("local_transit")) {
    modes.add("walking");
    modes.add("transfer");
  }
  const sum = (k: "cabinBags" | "checkedBags" | "bicycles") =>
    s.passengers.reduce((n, p) => n + p[k], 0);
  const intent: SearchIntent = {
    version: 1,
    origin: s.origin!.ref,
    destination: s.destination!.ref,
    departureDate: s.departureDate,
    returnDate: s.tripType === "return" ? s.returnDate : null,
    passengers: s.passengers.map((p) => ({
      id: p.key,
      age: Number(p.age),
      discounts: p.discounts.map((d) => ({
        scheme: d.scheme.trim(),
        provider: null,
        cardReference: d.cardReference.trim() || null,
      })),
    })),
    bags: { cabin: sum("cabinBags"), checked: sum("checkedBags"), bicycles: sum("bicycles") },
    modes: [...modes],
    preferences: {
      sort: s.sort,
      maxTransfers: s.maxTransfers === "" ? null : Number(s.maxTransfers),
      accessible: s.accessible ? true : null,
      cabin: s.cabin === "" ? null : s.cabin,
    },
    naturalLanguage: s.naturalLanguage.trim() || null,
  };
  const parsed = SearchIntentSchema.safeParse(intent);
  if (!parsed.success)
    return {
      ok: false,
      errors: { form: "Some details couldn't be validated. Check the fields and try again." },
    };
  return { ok: true, intent: parsed.data };
}

/** Field order for the error summary and focus management. */
export function fieldOrder(errors: FieldErrors) {
  const fixed = ["origin", "destination", "departureDate", "returnDate", "modes", "passengers"];
  return [
    ...fixed.filter((k) => errors[k]),
    ...Object.keys(errors).filter((k) => !fixed.includes(k)),
  ];
}
