// The single adapter from v1 search contracts to comparison view models.
// Components import the *View types from here, never @wayward/contracts.
import type {
  Itinerary,
  Leg,
  Mode,
  Offer,
  Place,
  Price,
  SearchResult,
  Transfer,
} from "@wayward/contracts";
import {
  dayOffset,
  formatDate,
  formatDuration,
  formatMoney,
  formatTime,
  localHour,
  minutesBetween,
  type MoneyValue,
} from "../../../lib/format";

export type ModeKey = Mode;
export const MODE_LABEL: Record<ModeKey, string> = {
  flight: "Flight",
  rail: "Train",
  coach: "Coach",
  ferry: "Ferry",
  local_transit: "Local transit",
  walking: "Walk",
  transfer: "Transfer",
};
const CONNECTIVE: ModeKey[] = ["walking", "transfer"];

export type Tone = "neutral" | "lime" | "ok" | "warn" | "danger" | "info";

export interface PlaceView {
  id: string;
  name: string;
  kind: Place["kind"];
  countryCode: string | null;
  timeZone: string;
}

export interface LegView {
  id: string;
  mode: ModeKey;
  modeLabel: string;
  origin: PlaceView;
  destination: PlaceView;
  departureUtc: string;
  arrivalUtc: string;
  departureLocal: string;
  arrivalLocal: string;
  dateLabel: string;
  arrivalDayOffset: number;
  durationMinutes: number;
  operator: string | null;
  timetableStatus: Leg["timetableStatus"];
  overnight: boolean;
  crowding: Leg["crowding"];
  seatMapAvailable: boolean | null;
}

export type TransferRating = "impossible" | "tight" | "ok" | "comfortable";
export interface TransferView {
  fromLegId: string;
  toLegId: string;
  atPlace: string;
  durationMinutes: number;
  minimumMinutes: number | null;
  rating: TransferRating;
  ratingLabel: string;
  tone: Tone;
  explanation: string;
  protection: Transfer["protection"];
  changeLocation: boolean;
  instructions: string | null;
  compatibility: Transfer["compatibility"];
}

export type PriceKind = Price["kind"];
export interface PriceLineView {
  label: string;
  category: string;
  categoryLabel: string;
  display: string;
  money: MoneyValue;
}
export interface PriceView {
  kind: PriceKind;
  kindLabel: string;
  kindTone: Tone;
  kindExplanation: string;
  display: string;
  total: MoneyValue | null;
  completeness: "complete" | "partial" | null;
  missingComponents: string[];
  breakdown: PriceLineView[];
  observedAt: string | null;
  /** Known, complete total that can be ranked against others. */
  comparable: boolean;
}

export type Aftersale = "supported" | "unsupported" | "unknown";
export interface ConditionsView {
  summary: string | null;
  termsUrl: string | null;
  refund: Aftersale;
  exchange: Aftersale;
  cancellation: Aftersale;
}
export interface BaggageView {
  /** null = unknown (service not listed). 0 = explicitly none. */
  cabin: number | null;
  checked: number | null;
}

/** Supplier prerequisites. null = unknown, never "unsupported". */
export interface BookingRequirementsView {
  holdSupported: boolean | null;
  priceGuaranteeExpiresAt: string | null;
  paymentRequiredBy: string | null;
  identityDocumentsRequired: boolean | null;
  supportedIdentityDocuments: ("passport" | "identity_card")[];
  /** Search passenger IDs the supplier mapped. */
  passengerIds: string[];
}

export interface JourneyView {
  id: string;
  source: "offer" | "timetable";
  offerId: string | null;
  searchId: string;
  origin: PlaceView;
  destination: PlaceView;
  departureUtc: string;
  arrivalUtc: string;
  departureLocal: string;
  arrivalLocal: string;
  dateLabel: string;
  arrivalDayOffset: number;
  departureHour: number;
  durationMinutes: number;
  changes: number;
  modes: ModeKey[];
  mainMode: ModeKey;
  operators: string[];
  legs: LegView[];
  transfers: TransferView[];
  worstTransfer: TransferRating | null;
  overnight: boolean;
  price: PriceView;
  seller: { id: string; name: string; merchantOfRecord: boolean | null } | null;
  provider: string;
  providerLabel: string;
  attribution: string | null;
  conditions: ConditionsView | null;
  baggage: BaggageView;
  includedServices: { kind: string; quantity: number | null; description: string }[];
  availability: Offer["availability"];
  environment: Offer["environment"];
  freshness: { state: Offer["freshness"]["state"]; fetchedAt: string; expiresAt: string | null } | null;
  completeness: Itinerary["completeness"];
  compatibility: Itinerary["compatibility"];
  missingConnections: string[];
  bookable: boolean;
  notBookableReason: string | null;
  /** Supplier sandbox inventory: bookable only in test checkout, never real travel. */
  testInventory: boolean;
  bookingRequirements: BookingRequirementsView | null;
}

export const PROVIDER_LABEL: Record<string, string> = {
  duffel: "Duffel",
  "public-transit": "Public timetables",
  vbb: "VBB timetables",
  "all-aboard": "All Aboard",
  distribusion: "Distribusion",
  omio: "Omio",
  "open-meteo": "GeoNames",
  geonames: "GeoNames",
};
export function providerLabel(id: string) {
  return PROVIDER_LABEL[id] ?? id;
}

function toPlace(p: Place): PlaceView {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    countryCode: p.countryCode,
    timeZone: p.timeZone,
  };
}

function toLeg(leg: Leg): LegView {
  const offset = dayOffset(
    leg.departureUtc,
    leg.origin.timeZone,
    leg.arrivalUtc,
    leg.destination.timeZone,
  );
  const duration = minutesBetween(leg.departureUtc, leg.arrivalUtc);
  const depHour = localHour(leg.departureUtc, leg.origin.timeZone);
  return {
    id: leg.id,
    mode: leg.mode,
    modeLabel: MODE_LABEL[leg.mode],
    origin: toPlace(leg.origin),
    destination: toPlace(leg.destination),
    departureUtc: leg.departureUtc,
    arrivalUtc: leg.arrivalUtc,
    departureLocal: formatTime(leg.departureUtc, leg.origin.timeZone),
    arrivalLocal: formatTime(leg.arrivalUtc, leg.destination.timeZone),
    dateLabel: formatDate(leg.departureUtc, leg.origin.timeZone),
    arrivalDayOffset: offset,
    durationMinutes: duration,
    operator: leg.operator,
    timetableStatus: leg.timetableStatus,
    // Overnight: crosses local midnight, or a long leg that leaves late at night.
    overnight: offset > 0 || ((depHour >= 22 || depHour < 4) && duration >= 180),
    crowding: leg.crowding,
    seatMapAvailable: leg.seatMapAvailable,
  };
}

const RATING_LABEL: Record<TransferRating, string> = {
  impossible: "Impossible",
  tight: "Tight",
  ok: "OK",
  comfortable: "Comfortable",
};
const RATING_TONE: Record<TransferRating, Tone> = {
  impossible: "danger",
  tight: "warn",
  ok: "info",
  comfortable: "ok",
};

/** Rates a change and explains it in plain language. Exported for tests. */
export function rateTransfer(input: {
  durationMinutes: number;
  minimumMinutes: number | null;
  changeLocation: boolean;
  protection: Transfer["protection"];
  compatibility: Transfer["compatibility"];
  atPlace: string;
}): { rating: TransferRating; explanation: string } {
  const { durationMinutes: d, minimumMinutes: min, changeLocation } = input;
  let rating: TransferRating;
  if (input.compatibility === "incompatible" || (min !== null && d < min))
    rating = "impossible";
  else if (min !== null)
    rating = d - min < 10 ? "tight" : d - min < 30 ? "ok" : "comfortable";
  else {
    const extra = changeLocation ? 15 : 0;
    rating = d < 15 + extra ? "tight" : d < 40 + extra ? "ok" : "comfortable";
  }
  const parts: string[] = [];
  const where = changeLocation
    ? `to get from ${input.atPlace} to the next departure point`
    : `to change at ${input.atPlace}`;
  parts.push(`${formatDuration(d)} ${where}.`);
  if (rating === "impossible")
    parts.push(
      min !== null && d < min
        ? `The published minimum here is ${formatDuration(min)}, so this connection can't be made as scheduled.`
        : "The supplier marks these legs as incompatible.",
    );
  else if (min !== null)
    parts.push(
      `That's ${formatDuration(d - min)} more than the published minimum of ${formatDuration(min)}.`,
    );
  else
    parts.push(
      "No published minimum connection time, so this rating is our estimate.",
    );
  if (changeLocation) parts.push("You change stations or terminals.");
  if (input.protection === "self_transfer")
    parts.push(
      "Self-transfer: if the first leg is late, the next one won't wait and isn't covered.",
    );
  else if (input.protection === "protected")
    parts.push("Protected: the seller rebooks you if you miss it.");
  else parts.push("Missed-connection protection is unknown.");
  return { rating, explanation: parts.join(" ") };
}

function toTransfers(it: Itinerary, legs: LegView[]): TransferView[] {
  return it.transfers.map((t) => {
    const from = legs.find((l) => l.id === t.fromLegId);
    const atPlace = from?.destination.name ?? "the station";
    const { rating, explanation } = rateTransfer({ ...t, atPlace });
    return {
      fromLegId: t.fromLegId,
      toLegId: t.toLegId,
      atPlace,
      durationMinutes: t.durationMinutes,
      minimumMinutes: t.minimumMinutes,
      rating,
      ratingLabel: RATING_LABEL[rating],
      tone: RATING_TONE[rating],
      explanation,
      protection: t.protection,
      changeLocation: t.changeLocation,
      instructions: t.instructions,
      compatibility: t.compatibility,
    };
  });
}

const KIND_META: Record<
  PriceKind,
  { label: string; tone: Tone; explanation: string }
> = {
  live_offer: {
    label: "Live price",
    tone: "ok",
    explanation:
      "Quoted by the seller for this search. We recheck it before you pay.",
  },
  test_offer: {
    label: "Test price",
    tone: "warn",
    explanation:
      "From a supplier test environment. It can't be booked for real travel.",
  },
  indicative: {
    label: "Indicative",
    tone: "warn",
    explanation: "An estimate, not a quote. The real price may differ.",
  },
  historical_observation: {
    label: "Seen before",
    tone: "neutral",
    explanation: "A price observed in the past, not a current offer.",
  },
  published_tariff_range: {
    label: "Tariff range",
    tone: "neutral",
    explanation: "A published fare range. It is not an offer you can book.",
  },
  unknown: {
    label: "Price unknown",
    tone: "neutral",
    explanation:
      "This source gives timetables only: no price, no seat availability.",
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  fare: "Base fare",
  tax: "Taxes",
  baggage: "Baggage",
  service: "Seller fees",
  payment: "Payment fees",
  transfer: "Transfers",
  other: "Other",
};

export function toPriceView(price: Price): PriceView {
  const meta = KIND_META[price.kind];
  const base = {
    kind: price.kind,
    kindLabel: meta.label,
    kindTone: meta.tone,
    kindExplanation: meta.explanation,
  };
  if (price.kind === "unknown")
    return {
      ...base,
      display: "Price unknown",
      total: null,
      completeness: null,
      missingComponents: [],
      breakdown: [],
      observedAt: null,
      comparable: false,
    };
  if (price.kind === "published_tariff_range")
    return {
      ...base,
      display: `${formatMoney(price.minimum, { compact: true })}–${formatMoney(price.maximum, { compact: true })}`,
      total: null,
      completeness: null,
      missingComponents: [],
      breakdown: [],
      observedAt: price.observedAt,
      comparable: false,
    };
  return {
    ...base,
    display: formatMoney(price.total),
    total: price.total,
    completeness: price.completeness,
    missingComponents: price.missingComponents,
    breakdown: price.breakdown.map((b) => ({
      label: b.label,
      category: b.category,
      categoryLabel: CATEGORY_LABEL[b.category] ?? b.category,
      display: formatMoney(b.money),
      money: b.money,
    })),
    observedAt: price.observedAt,
    comparable:
      price.completeness === "complete" &&
      (price.kind === "live_offer" || price.kind === "test_offer"),
  };
}

/**
 * Sources sometimes emit zero-length connector legs (a 0-minute "walk" from a
 * stop to itself). Those split one real change into two confusing ones, so we
 * drop them and merge the surrounding transfers. Real walks are kept.
 */
export function collapseTrivialConnectors(it: Itinerary): Itinerary {
  const trivial = new Set(
    it.legs
      .filter(
        (l) =>
          CONNECTIVE.includes(l.mode) &&
          l.origin.id === l.destination.id &&
          Date.parse(l.arrivalUtc) - Date.parse(l.departureUtc) <= 60_000,
      )
      .map((l) => l.id),
  );
  if (!trivial.size || trivial.size === it.legs.length) return it;
  const legs = it.legs.filter((l) => !trivial.has(l.id));
  const transfers: Transfer[] = [];
  for (let i = 0; i < legs.length - 1; i++) {
    const from = legs[i]!;
    const to = legs[i + 1]!;
    // Walk the original chain from `from` to `to`, folding transfers together.
    const chain: Transfer[] = [];
    let cursor = from.id;
    for (let guard = 0; guard < it.transfers.length + 1; guard++) {
      const t = it.transfers.find((x) => x.fromLegId === cursor);
      if (!t) break;
      chain.push(t);
      if (t.toLegId === to.id) break;
      cursor = t.toLegId;
    }
    if (!chain.length || chain[chain.length - 1]!.toLegId !== to.id) continue;
    const order = { incompatible: 0, unverified: 1, verified: 2 } as const;
    const prot = { self_transfer: 0, unknown: 1, protected: 2 } as const;
    transfers.push({
      fromLegId: from.id,
      toLegId: to.id,
      durationMinutes: Math.max(0, Math.round((Date.parse(to.departureUtc) - Date.parse(from.arrivalUtc)) / 60_000)),
      minimumMinutes: chain.every((t) => t.minimumMinutes !== null)
        ? Math.max(...chain.map((t) => t.minimumMinutes!))
        : null,
      protection: chain.reduce((a, t) => (prot[t.protection] < prot[a] ? t.protection : a), chain[0]!.protection),
      changeLocation: chain.some((t) => t.changeLocation),
      instructions: chain.map((t) => t.instructions).filter(Boolean).join(" ") || null,
      compatibility: chain.reduce((a, t) => (order[t.compatibility] < order[a] ? t.compatibility : a), chain[0]!.compatibility),
    });
  }
  return { ...it, legs, transfers };
}

function summarise(raw: Itinerary) {
  const it = collapseTrivialConnectors(raw);
  const legs = it.legs.map(toLeg);
  const first = legs[0]!;
  const last = legs[legs.length - 1]!;
  const transfers = toTransfers(it, legs);
  const order: TransferRating[] = ["impossible", "tight", "ok", "comfortable"];
  const worst =
    transfers
      .map((t) => t.rating)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? null;
  const modes = [...new Set(legs.map((l) => l.mode))];
  const main = legs
    .filter((l) => !CONNECTIVE.includes(l.mode))
    .sort((a, b) => b.durationMinutes - a.durationMinutes)[0];
  const travelLegs = legs.filter((l) => !CONNECTIVE.includes(l.mode));
  return {
    legs,
    transfers,
    worstTransfer: worst,
    origin: first.origin,
    destination: last.destination,
    departureUtc: first.departureUtc,
    arrivalUtc: last.arrivalUtc,
    departureLocal: first.departureLocal,
    arrivalLocal: last.arrivalLocal,
    dateLabel: first.dateLabel,
    arrivalDayOffset: dayOffset(
      first.departureUtc,
      first.origin.timeZone,
      last.arrivalUtc,
      last.destination.timeZone,
    ),
    departureHour: localHour(first.departureUtc, first.origin.timeZone),
    durationMinutes: minutesBetween(first.departureUtc, last.arrivalUtc),
    changes: Math.max(0, travelLegs.length - 1),
    modes,
    mainMode: main?.mode ?? first.mode,
    operators: [
      ...new Set(legs.map((l) => l.operator).filter((o): o is string => !!o)),
    ],
    overnight: legs.some((l) => l.overnight),
    completeness: it.completeness,
    compatibility: it.compatibility,
    missingConnections: it.missingConnections,
  };
}

function baggageFrom(services: Offer["includedServices"]): BaggageView {
  const count = (kind: "cabin_bag" | "checked_bag") => {
    const s = services.filter((x) => x.kind === kind);
    if (!s.length) return null;
    if (s.some((x) => x.quantity === null)) return null;
    return s.reduce((n, x) => n + (x.quantity ?? 0), 0);
  };
  return { cabin: count("cabin_bag"), checked: count("checked_bag") };
}

/**
 * Live offers book in live checkout; supplier test offers book only in the
 * matching test checkout (checked again per order by the backend). Everything
 * else (indicative, historical, ranges, unknown) is never bookable.
 */
function bookability(offer: Offer): string | null {
  const matching =
    (offer.price.kind === "live_offer" && offer.environment === "live") ||
    (offer.price.kind === "test_offer" && offer.environment === "test");
  if (!matching || !("completeness" in offer.price)) return "Not a seller's current offer, so it can't be booked.";
  if (offer.price.completeness !== "complete")
    return "The total is incomplete, so it can't be booked yet.";
  if (offer.availability !== "available")
    return offer.availability === "sold_out"
      ? "Sold out."
      : "Availability isn't confirmed.";
  if (offer.freshness.state === "expired")
    return "This offer has expired. Search again for a fresh price.";
  // Wayward books by holding first; only offers the seller confirms can be
  // held are reservable (instant-payment-only offers are rejected).
  const hold = offer.bookingRequirements?.holdSupported ?? null;
  if (hold === false)
    return "Instant payment only. Wayward can't book this offer yet because it can't be held first.";
  if (hold === null)
    return "The seller hasn't said whether this offer can be held, so Wayward can't book it yet.";
  return null;
}

export function toOfferJourney(offer: Offer, searchId: string): JourneyView {
  const s = summarise(offer.itinerary);
  const reason = bookability(offer);
  return {
    id: offer.id,
    source: "offer",
    offerId: offer.id,
    searchId,
    ...s,
    price: toPriceView(offer.price),
    seller: offer.seller,
    provider: offer.provider,
    providerLabel: providerLabel(offer.provider),
    attribution: null,
    conditions: {
      summary: offer.conditions.summary,
      termsUrl: offer.conditions.termsUrl,
      ...offer.conditions.aftersales,
    },
    baggage: baggageFrom(offer.includedServices),
    includedServices: offer.includedServices,
    availability: offer.availability,
    environment: offer.environment,
    freshness: offer.freshness,
    bookable: reason === null,
    notBookableReason: reason,
    testInventory: offer.environment === "test",
    bookingRequirements: offer.bookingRequirements
      ? {
          holdSupported: offer.bookingRequirements.holdSupported,
          priceGuaranteeExpiresAt: offer.bookingRequirements.priceGuaranteeExpiresAt,
          paymentRequiredBy: offer.bookingRequirements.paymentRequiredBy,
          identityDocumentsRequired: offer.bookingRequirements.identityDocumentsRequired,
          supportedIdentityDocuments: offer.bookingRequirements.supportedIdentityDocuments.filter(
            (d): d is "passport" | "identity_card" => d === "passport" || d === "identity_card",
          ),
          passengerIds: offer.bookingRequirements.passengerMappings.map((m) => m.passengerId),
        }
      : null,
  };
}

type TimetableJourney = NonNullable<SearchResult["timetableJourneys"]>[number];
export function toTimetableJourney(
  j: TimetableJourney,
  searchId: string,
): JourneyView {
  const s = summarise(j.itinerary);
  return {
    id: `tt:${j.itinerary.id}`,
    source: "timetable",
    offerId: null,
    searchId,
    ...s,
    price: toPriceView(j.price),
    seller: null,
    provider: j.source,
    providerLabel: providerLabel(j.source),
    attribution: j.attribution,
    conditions: null,
    baggage: { cabin: null, checked: null },
    includedServices: [],
    availability: j.availability,
    environment: "unknown",
    freshness: null,
    bookable: false,
    notBookableReason:
      "Timetable only. No seller has offered seats or a price for this journey.",
    testInventory: false,
    bookingRequirements: null,
  };
}

// ---------- Results ----------

export type ProviderStatus = "complete" | "failed" | "unconfigured" | "unsupported";
export interface ProviderStatusView {
  id: string;
  label: string;
  status: ProviderStatus;
  statusLabel: string;
  tone: Tone;
  message: string | null;
}
export interface ResultsView {
  searchId: string;
  state: SearchResult["state"];
  createdAt: string;
  updatedAt: string;
  journeys: JourneyView[];
  offerCount: number;
  timetableCount: number;
  providers: ProviderStatusView[];
  /** Sources we actually asked (excludes not-yet-integrated suppliers). */
  asked: number;
  answered: number;
  notIntegrated: number;
  warnings: string[];
}

const STATUS_META: Record<ProviderStatus, { label: string; tone: Tone }> = {
  complete: { label: "Answered", tone: "ok" },
  failed: { label: "Failed", tone: "danger" },
  unconfigured: { label: "Not configured", tone: "warn" },
  unsupported: { label: "Not integrated yet", tone: "neutral" },
};

export function toResultsView(result: SearchResult): ResultsView {
  const offers = result.offers.map((o) => toOfferJourney(o, result.searchId));
  const timetable = (result.timetableJourneys ?? []).map((j) =>
    toTimetableJourney(j, result.searchId),
  );
  const providers = (result.providerStatuses ?? []).map((p) => ({
    id: p.provider,
    label: providerLabel(p.provider),
    status: p.status,
    statusLabel: STATUS_META[p.status].label,
    tone: STATUS_META[p.status].tone,
    message: p.message,
  }));
  const providerMessages = new Set(
    providers.map((p) => `${p.id}: ${p.message}`),
  );
  const asked = providers.filter((p) => p.status !== "unsupported").length;
  return {
    searchId: result.searchId,
    state: result.state,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt ?? result.createdAt,
    journeys: [...offers, ...timetable],
    offerCount: offers.length,
    timetableCount: timetable.length,
    providers,
    asked,
    answered: providers.filter((p) => p.status === "complete").length,
    notIntegrated: providers.length - asked,
    warnings: [...new Set(result.warnings)].filter(
      (w) => !providerMessages.has(w),
    ),
  };
}
