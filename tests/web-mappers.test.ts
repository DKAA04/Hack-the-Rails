import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Offer, Place, SearchResult } from "../packages/contracts/src/index";
import {
  rateTransfer,
  toOfferJourney,
  toPriceView,
  toResultsView,
} from "../apps/web/src/features/comparison/mappers/journey";
import { computePicks } from "../apps/web/src/features/comparison/picks";
import { applyFilters, EMPTY_FILTERS, sortJourneys } from "../apps/web/src/features/comparison/filters";
import { findConflicts, tripTotal } from "../apps/web/src/features/trip/conflicts";
import { initialSearchState, toSearchIntent } from "../apps/web/src/features/search/mappers/intent";
import { toPlaceOption } from "../apps/web/src/features/search/mappers/places";
import { formatMoney } from "../apps/web/src/lib/format";

const place = (id: string, name: string, tz = "Europe/Berlin"): Place => ({
  id,
  name,
  kind: "station",
  countryCode: "DE",
  timeZone: tz,
  providerIds: [{ provider: "vbb", id }],
  coordinates: null,
});
const A = place("a", "Berlin Hbf");
const B = place("b", "Hamburg Hbf");
const C = place("c", "Kraków Główny", "Europe/Warsaw");

function offer(id: string, opts: { amount?: number; dep: string; arr: string; mode?: "rail" | "coach" | "flight"; legs?: number }): Offer {
  const legs = Array.from({ length: opts.legs ?? 1 }, (_, i) => ({
    id: `${id}-l${i}`,
    mode: opts.mode ?? "rail",
    origin: i === 0 ? A : B,
    destination: i === (opts.legs ?? 1) - 1 ? B : B,
    departureUtc: opts.dep,
    arrivalUtc: opts.arr,
    operator: "DB",
    providerIds: [],
    timetableStatus: "scheduled" as const,
    seatMapAvailable: null,
    crowding: "unknown" as const,
  }));
  return {
    id,
    provider: "duffel",
    providerOfferId: id,
    seller: { id: "s1", name: "Seller", merchantOfRecord: true },
    itinerary: {
      id: `${id}-it`,
      legs,
      transfers: [],
      completeness: "complete",
      compatibility: "verified",
      missingConnections: [],
    },
    price:
      opts.amount === undefined
        ? { kind: "unknown" }
        : {
            kind: "live_offer",
            total: { amount: opts.amount, currency: "EUR" },
            completeness: "complete",
            missingComponents: [],
            breakdown: [{ label: "Fare", money: { amount: opts.amount, currency: "EUR" }, category: "fare" }],
            observedAt: "2026-11-21T10:00:00Z",
          },
    availability: "available",
    environment: "live",
    freshness: { fetchedAt: "2026-11-21T10:00:00Z", expiresAt: null, state: "fresh" },
    conditions: { summary: null, termsUrl: null, aftersales: { refund: "unknown", exchange: "unknown", cancellation: "unknown" } },
    includedServices: [],
    reservationState: "not_reserved",
  };
}

test("money formats from integer minor units without float drift", () => {
  assert.equal(formatMoney({ amount: 12345, currency: "EUR" }), "€123.45");
  assert.equal(formatMoney({ amount: 10, currency: "EUR" }), "€0.10");
  assert.equal(formatMoney({ amount: 1500, currency: "JPY" }), "JP¥1,500");
});

test("unknown prices stay unknown and never become comparable", () => {
  const v = toPriceView({ kind: "unknown" });
  assert.equal(v.total, null);
  assert.equal(v.comparable, false);
  assert.equal(v.display, "Price unknown");
});

test("timetable journeys are never bookable and keep attribution", () => {
  const r: SearchResult = {
    searchId: "s",
    state: "partial",
    createdAt: "2026-11-21T10:00:00Z",
    offers: [],
    warnings: ["duffel: missing", "VBB returned partial data"],
    timetableJourneys: [
      {
        itinerary: offer("t", { dep: "2026-11-22T08:00:00Z", arr: "2026-11-22T10:00:00Z" }).itinerary,
        source: "vbb",
        attribution: "VBB",
        price: { kind: "unknown" },
        availability: "unknown",
        bookingSupported: false,
      },
    ],
    providerStatuses: [
      { provider: "duffel", status: "unconfigured", message: "missing" },
      { provider: "public-transit", status: "complete", message: null },
      { provider: "omio", status: "unsupported", message: "nope" },
    ],
  };
  const v = toResultsView(r);
  assert.equal(v.journeys[0]!.bookable, false);
  assert.equal(v.journeys[0]!.attribution, "VBB");
  assert.equal(v.asked, 2);
  assert.equal(v.answered, 1);
  assert.equal(v.notIntegrated, 1);
  assert.deepEqual(v.warnings, ["VBB returned partial data"]);
});

test("picks explain themselves and never rank unknown prices as cheap", () => {
  const cheapSlow = toOfferJourney(offer("c", { amount: 2000, dep: "2026-11-22T06:00:00Z", arr: "2026-11-22T12:00:00Z", mode: "coach" }), "s");
  const fast = toOfferJourney(offer("f", { amount: 9000, dep: "2026-11-22T08:00:00Z", arr: "2026-11-22T10:00:00Z", mode: "rail" }), "s");
  const unknown = toOfferJourney(offer("u", { dep: "2026-11-22T08:00:00Z", arr: "2026-11-22T11:00:00Z" }), "s");
  const picks = computePicks([unknown, fast, cheapSlow]);
  assert.equal(picks.cheapest.journey?.id, "c");
  assert.match(picks.cheapest.reason, /4h slower/);
  assert.match(picks.cheapest.reason, /coach, not a train/);
  assert.equal(picks.fastest.journey?.id, "f");
  assert.match(picks.comfortable.reason, /fewest changes/i);
  const sorted = sortJourneys([unknown, fast, cheapSlow], "price");
  assert.equal(sorted.at(-1)!.id, "u");
});

test("baggage filter treats unlisted bags as unknown, not included", () => {
  const j = toOfferJourney(offer("x", { amount: 1, dep: "2026-11-22T06:00:00Z", arr: "2026-11-22T07:00:00Z" }), "s");
  assert.equal(j.baggage.checked, null);
  assert.equal(applyFilters([j], { ...EMPTY_FILTERS, checkedBagIncluded: true }).length, 0);
});

test("transfer ratings use published minimums and explain self-transfers", () => {
  const impossible = rateTransfer({ durationMinutes: 8, minimumMinutes: 10, changeLocation: false, protection: "unknown", compatibility: "unverified", atPlace: "Köln Hbf" });
  assert.equal(impossible.rating, "impossible");
  const tight = rateTransfer({ durationMinutes: 12, minimumMinutes: null, changeLocation: false, protection: "self_transfer", compatibility: "unverified", atPlace: "Köln Hbf" });
  assert.equal(tight.rating, "tight");
  assert.match(tight.explanation, /won't wait/);
  assert.equal(
    rateTransfer({ durationMinutes: 60, minimumMinutes: null, changeLocation: true, protection: "protected", compatibility: "verified", atPlace: "X" }).rating,
    "comfortable",
  );
});

test("trip conflicts catch overlaps and location gaps; totals never mix currencies", () => {
  const first = toOfferJourney(offer("1", { amount: 1000, dep: "2026-11-22T06:00:00Z", arr: "2026-11-22T09:00:00Z" }), "s");
  const overlapping = toOfferJourney(offer("2", { amount: 500, dep: "2026-11-22T08:00:00Z", arr: "2026-11-22T10:00:00Z" }), "s");
  const conflicts = findConflicts([first, overlapping]);
  assert.ok(conflicts.some((c) => c.kind === "overlap" && c.severity === "danger"));
  const gap = { ...overlapping, departureUtc: "2026-11-22T12:00:00Z", origin: { ...overlapping.origin, id: "elsewhere", name: "Altona" } };
  assert.ok(findConflicts([first, gap]).some((c) => c.kind === "location_gap"));
  const unknown = toOfferJourney(offer("3", { dep: "2026-11-22T12:00:00Z", arr: "2026-11-22T13:00:00Z" }), "s");
  const total = tripTotal([first, overlapping, unknown]);
  assert.equal(total.knownDisplay, "€15.00");
  assert.equal(total.unknownCount, 1);
  assert.equal(total.complete, false);
});

test("search intent requires resolved places and passes them intact", () => {
  const empty = toSearchIntent(initialSearchState());
  assert.equal(empty.ok, false);
  if (!empty.ok) {
    assert.ok(empty.errors.origin);
    assert.ok(empty.errors.departureDate);
  }
  const s = initialSearchState();
  s.origin = toPlaceOption(A);
  s.destination = toPlaceOption(C);
  s.departureDate = "2099-01-01";
  s.modes = ["local_transit"];
  s.passengers[0]!.checkedBags = 2;
  s.passengers[0]!.discounts = [{ key: "d", scheme: "BahnCard 50", cardReference: "" }];
  const r = toSearchIntent(s);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.intent.origin, A);
    assert.deepEqual(r.intent.destination.providerIds, C.providerIds);
    assert.equal(r.intent.bags.checked, 2);
    assert.ok(r.intent.modes.includes("walking"));
    assert.equal(r.intent.passengers[0]!.discounts[0]!.cardReference, null);
    assert.equal(r.intent.returnDate, null);
  }
});

test("only mapper modules and the API client import contracts in apps/web", () => {
  const root = join(import.meta.dirname, "../apps/web/src");
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== "api") walk(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const rel = relative(root, p);
      const src = readFileSync(p, "utf8");
      if (/@wayward\/server/.test(src)) offenders.push(`${rel} imports server`);
      const allowed = rel === "lib/api-client.ts" || /(^|\/)mappers\//.test(rel);
      if (!allowed && /from\s+["']@wayward\/contracts["']/.test(src)) offenders.push(rel);
    }
  };
  walk(root);
  assert.deepEqual(offenders, []);
});

test("zero-length connector legs are folded into one real change", async () => {
  const { collapseTrivialConnectors } = await import("../apps/web/src/features/comparison/mappers/journey");
  const base = offer("z", { dep: "2026-11-22T07:19:00Z", arr: "2026-11-22T07:29:00Z", legs: 1 }).itinerary;
  const l1 = { ...base.legs[0]!, id: "l1", destination: B, arrivalUtc: "2026-11-22T07:29:00Z" };
  const walk = { ...l1, id: "w", mode: "walking" as const, origin: B, destination: B, departureUtc: "2026-11-22T07:29:00Z", arrivalUtc: "2026-11-22T07:29:00Z" };
  const l3 = { ...l1, id: "l3", origin: B, destination: C, departureUtc: "2026-11-22T07:34:00Z", arrivalUtc: "2026-11-22T07:51:00Z" };
  const t = (f: string, to: string, d: number) => ({ fromLegId: f, toLegId: to, durationMinutes: d, minimumMinutes: null, protection: "unknown" as const, changeLocation: false, instructions: null, compatibility: "unverified" as const });
  const out = collapseTrivialConnectors({ ...base, legs: [l1, walk, l3], transfers: [t("l1", "w", 0), t("w", "l3", 5)] });
  assert.deepEqual(out.legs.map((l) => l.id), ["l1", "l3"]);
  assert.equal(out.transfers.length, 1);
  assert.equal(out.transfers[0]!.durationMinutes, 5);
});

test("order view keeps payment, booking and ticket states separate; samples validate", async () => {
  const { sampleOrderView } = await import("../apps/web/src/features/account/mappers/sample-orders.fixture");
  const pending = sampleOrderView("pending");
  assert.equal(pending.paymentLabel, "Authorised, not yet taken");
  assert.equal(pending.ticketCount, 0);
  assert.equal(pending.total.kind, "test_offer");
  const confirmed = sampleOrderView("confirmed");
  assert.equal(confirmed.ticketCount, 2);
  assert.equal(confirmed.fulfilmentLabel, "All tickets issued");
});

test("checkout validation explains age mismatches and sends only contract fields", async () => {
  const { validateTravellers, toCreateOrderRequest } = await import("../apps/web/src/features/checkout/mappers/order");
  const t = [{ key: "p1", givenName: "Ana", familyName: "Silva", dateOfBirth: "2000-06-01", age: 30, discounts: [] }];
  const errs = validateTravellers(t, { email: "ana@", phone: "" }, "2026-11-22");
  assert.match(errs.email!, /doesn't look complete/);
  assert.match(errs["t0-dob"]!, /makes them 26/);
  const req = toCreateOrderRequest("q", "k", t, { email: "ana@example.com", phone: "" }, "2026-11-22");
  assert.deepEqual(Object.keys(req.passengers[0]!).sort(), ["age", "discounts", "id"]);
});

test("same-route or overlapping journeys become options, not impossible legs", async () => {
  const { isAlternative } = await import("../apps/web/src/features/trip/store");
  const a = toOfferJourney(offer("a1", { amount: 100, dep: "2026-11-22T08:00:00Z", arr: "2026-11-22T09:00:00Z" }), "s");
  const sameRouteLater = toOfferJourney(offer("a2", { amount: 100, dep: "2026-11-22T12:00:00Z", arr: "2026-11-22T13:00:00Z" }), "s");
  const onward = { ...sameRouteLater, id: "a3", origin: a.destination, destination: { ...a.destination, id: "zz", name: "Elsewhere" } };
  assert.equal(isAlternative(sameRouteLater, [a]), true);
  assert.equal(isAlternative(onward, [a]), false);
});

test("recommended sort demotes tight self-transfers below safer journeys", () => {
  const direct = toOfferJourney(offer("d", { dep: "2026-11-22T08:00:00Z", arr: "2026-11-22T09:00:00Z" }), "s");
  const risky = { ...toOfferJourney(offer("r", { dep: "2026-11-22T08:00:00Z", arr: "2026-11-22T08:50:00Z" }), "s"), worstTransfer: "tight" as const };
  assert.equal(sortJourneys([risky, direct], "recommended")[0]!.id, "d");
});
