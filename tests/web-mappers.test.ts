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
      const rel = relative(root, p).replaceAll("\\", "/");
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

test("checkout maps travellers to BookingPassenger/BookingContact with E.164 and documents only when required", async () => {
  const m = await import("../apps/web/src/features/checkout/mappers/order");
  const t = [{
    passengerId: "p1", age: 30, title: "ms" as const, gender: "f" as const, givenName: " Ana ", familyName: "Silva",
    bornOn: "2000-06-01", document: { type: "passport" as const, number: "X123", issuingCountry: "pt", expiresOn: "2030-01-01" }, discounts: [],
  }];
  const noDocs = { required: false, accepted: [] };
  const errs = m.validateTravellers(t, { email: "ana@", phone: "030 1234567" }, "2026-11-22", noDocs);
  assert.match(errs.email!, /doesn't look complete/);
  assert.match(errs.phone!, /Start with \+/);
  assert.match(errs["t0-dob"]!, /would be 26/);
  assert.equal(m.normalisePhone("+49 (30) 123-4567"), "+49301234567");
  assert.equal(m.normalisePhone("0049 30 1234567"), "+49301234567");
  const base = { quoteId: "q", idempotencyKey: "k", travellers: t, contact: { email: "ana@example.com", phone: "+351 912 345 678" }, travelDateIso: "2026-11-22", acceptChanges: false };
  const req = m.toCreateOrderRequest({ ...base, policy: noDocs });
  assert.equal(req.travellers![0]!.passengerId, "p1");
  assert.equal(req.travellers![0]!.givenName, "Ana");
  assert.deepEqual(req.travellers![0]!.identityDocuments, []);
  assert.equal(req.contact!.phoneNumber, "+351912345678");
  assert.equal("acceptChanges" in req, false);
  const withDocs = m.toCreateOrderRequest({ ...base, policy: { required: true, accepted: ["passport"] }, acceptChanges: true });
  assert.equal(withDocs.travellers![0]!.identityDocuments[0]!.issuingCountryCode, "PT");
  assert.equal(withDocs.acceptChanges, true);
  const { CreateOrderRequestSchema } = await import("../packages/contracts/src/index");
  assert.equal(CreateOrderRequestSchema.safeParse(withDocs).success, true);
  const docErr = m.validateTravellers([{ ...t[0]!, document: { type: "identity_card", number: "", issuingCountry: "P", expiresOn: "2026-01-01" } }], base.contact, "2026-11-22", { required: true, accepted: ["passport"] });
  assert.ok(docErr["t0-doctype"] && docErr["t0-docnum"] && docErr["t0-doccountry"] && docErr["t0-docexp"]);
});

test("workflow covers all 13 phases; polls only on poll with default 2000ms; null deadlines stay null", async () => {
  const m = await import("../apps/web/src/features/checkout/mappers/order");
  assert.equal(m.PHASES.length, 13);
  for (const p of m.PHASES) assert.ok(m.PHASE_COPY[p].title && m.PHASE_COPY[p].body);
  const w = (phase: (typeof m.PHASES)[number], nextAction: m.NextAction, retryAfterMs: number | null = null) =>
    m.toWorkflowView({ phase, nextAction, checkoutReady: false, reasons: [], retryAfterMs, paymentRequiredBy: null, priceGuaranteeExpiresAt: null });
  assert.equal(w("reserving", "poll").pollMs, 2000);
  assert.equal(w("reserving", "poll", 5000).pollMs, 5000);
  assert.equal(w("reserved", "checkout", 5000).pollMs, null);
  assert.equal(w("complete", "none").terminal, true);
  assert.equal(w("expired", "none").terminal, true);
  assert.equal(w("manual_review", "contact_support").terminal, false);
  assert.equal(w("manual_review", "contact_support").pollMs, null);
  assert.equal(w("reserved", "checkout").paymentRequiredBy, null);
});

test("supplier documents keep the real reference when no file exists; tickets only from tickets[]", async () => {
  const { sampleOrderView } = await import("../apps/web/src/features/account/mappers/sample-orders.fixture");
  const o = sampleOrderView("confirmed");
  const doc = o.bookings[0]!.supplierDocuments[0]!;
  assert.equal(doc.reference, "SAMPLE-0012345678");
  assert.equal(doc.downloadUrl, null);
  assert.equal(doc.issuedAt, null);
  assert.equal(o.ticketCount, 2);
  assert.equal(sampleOrderView("reserved").workflow!.paymentRequiredBy, "2026-11-22T09:30:00Z");
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

test("traveller details never reach browser storage, URLs or logs", () => {
  const root = join(import.meta.dirname, "../apps/web/src");
  const checkout = readFileSync(join(root, "features/checkout/checkout-view.tsx"), "utf8");
  const mapper = readFileSync(join(root, "features/checkout/mappers/order.ts"), "utf8");
  assert.equal(/sessionStorage\.(get|set|remove)Item/.test(checkout + mapper), false);
  // The only localStorage write in checkout stores opaque order IDs.
  const writes = checkout.match(/localStorage\.setItem\([^\r\n]*/g) ?? [];
  assert.deepEqual(writes, ["localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([order.id, ...ids.filter((x) => x !== order.id)]));"]);
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? (n === "api" ? [] : walk(join(dir, n))) : /\.tsx?$/.test(n) ? [join(dir, n)] : []));
  for (const f of walk(root)) assert.equal(/console\.(log|info|debug)\(/.test(readFileSync(f, "utf8")), false, f);
  // Documents are never put in a URL.
  assert.equal(/uniqueIdentifier[^\n]*(searchParams|URLSearchParams|\?)/.test(mapper), false);
});

test("test offers are bookable only as labelled test inventory; non-offers never", () => {
  const br = { holdSupported: true, priceGuaranteeExpiresAt: null, paymentRequiredBy: null, identityDocumentsRequired: false, supportedIdentityDocuments: [], passengerMappings: [] };
  const live = { ...offer("live1", { amount: 1000, dep: "2026-11-22T06:00:00Z", arr: "2026-11-22T07:00:00Z" }), bookingRequirements: br };
  const test = { ...live, id: "t1", environment: "test" as const, price: { ...(live.price as Extract<Offer["price"], { kind: "live_offer" }>), kind: "test_offer" as const } };
  const tj = toOfferJourney(test, "s");
  assert.equal(tj.bookable, true);
  assert.equal(tj.testInventory, true);
  assert.equal(toOfferJourney(live, "s").testInventory, false);
  const indicative = { ...live, id: "i1", price: { ...(live.price as Extract<Offer["price"], { kind: "live_offer" }>), kind: "indicative" as const } };
  assert.equal(toOfferJourney(indicative, "s").bookable, false);
  const mismatched = { ...test, environment: "live" as const };
  assert.equal(toOfferJourney(mismatched, "s").bookable, false);
  const instantOnly = toOfferJourney({ ...test, bookingRequirements: { ...br, holdSupported: false } }, "s");
  assert.equal(instantOnly.bookable, false);
  assert.match(instantOnly.notBookableReason!, /Instant payment only/);
  assert.equal(toOfferJourney({ ...test, bookingRequirements: { ...br, holdSupported: null } }, "s").bookable, false);
  assert.equal(toOfferJourney({ ...test, bookingRequirements: undefined }, "s").bookable, false);
});

test("checkout readiness comes from workflow.checkoutReady, not a global flag", async () => {
  const m = await import("../apps/web/src/features/checkout/mappers/order");
  const v = m.toWorkflowView({ phase: "ready_for_checkout", nextAction: "checkout", checkoutReady: true, reasons: [], retryAfterMs: null, paymentRequiredBy: null, priceGuaranteeExpiresAt: null });
  assert.equal(v.checkoutReady, true);
  assert.equal(v.pollMs, null);
});

test("seller fare rules embedded in conditions.summary become plain rules; money stays integer", async () => {
  const { parseConditionsSummary, decimalToMinor } = await import("../apps/web/src/features/comparison/mappers/journey");
  const { sellerRulesLine } = await import("../apps/web/src/features/comparison/fare-rules");
  assert.equal(decimalToMinor("10.00", "EUR"), 1000);
  assert.equal(decimalToMinor("10.5", "EUR"), 1050);
  assert.equal(decimalToMinor("1500", "JPY"), 1500);
  assert.equal(decimalToMinor("abc", "EUR"), null);
  const summary =
    'Airline: Duffel Airways. Supplier fare rules: {"refund_before_departure":{"allowed":false,"penalty_amount":null,"penalty_currency":null},"change_before_departure":{"allowed":true,"penalty_amount":"10.00","penalty_currency":"EUR"}}. Null penalty values are unknown, not zero.';
  const r = parseConditionsSummary(summary);
  assert.equal(r.sellerRules!.refundBeforeDeparture!.allowed, false);
  assert.deepEqual(r.sellerRules!.changeBeforeDeparture!.fee, { amount: 1000, currency: "EUR" });
  assert.equal(r.summary!.includes("{"), false);
  assert.equal(sellerRulesLine(r.sellerRules), "Non-refundable · changes €10.00");
  const unknownFee = parseConditionsSummary('Supplier fare rules: {"refund_before_departure":{"allowed":true,"penalty_amount":null,"penalty_currency":null}}.');
  assert.equal(sellerRulesLine(unknownFee.sellerRules), "Refundable, fee unknown · change rules unknown");
  assert.deepEqual(parseConditionsSummary("Supplier fare rules: {broken"), { summary: "Supplier fare rules: {broken", sellerRules: null });
});
