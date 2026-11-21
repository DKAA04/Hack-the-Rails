import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PlaceLookupRequestSchema,
  SearchResultSchema,
} from "../packages/contracts/src/index";
import { localToUtc } from "../packages/server/src/routing/time";
import { decimalMoney } from "../packages/server/src/pricing/money";
import { composeLegs } from "../packages/server/src/routing/compose";
import { normalizeDuffelPlace } from "../packages/server/src/places";
test("local supplier times convert to UTC and DST ambiguity never guesses", () => {
  assert.equal(
    localToUtc("2026-07-01T12:00:00", "Europe/Paris"),
    "2026-07-01T10:00:00.000Z",
  );
  assert.equal(
    localToUtc("2026-12-01T12:00:00", "Europe/Paris"),
    "2026-12-01T11:00:00.000Z",
  );
  assert.throws(() => localToUtc("2026-03-29T02:30:00", "Europe/Paris"));
  assert.throws(() => localToUtc("2026-10-25T02:30:00", "Europe/Paris"));
});
test("supplier money uses currency minor units without floating point", () => {
  assert.deepEqual(decimalMoney("10.01", "EUR"), {
    amount: 1001,
    currency: "EUR",
  });
  assert.equal(decimalMoney("10", "JPY").amount, 10);
  assert.equal(decimalMoney("1.234", "KWD").amount, 1234);
  assert.throws(() => decimalMoney("1.001", "EUR"));
});
test("place lookup bounds and missing supplier time zone are enforced", () => {
  assert.equal(
    PlaceLookupRequestSchema.safeParse({ query: "x" }).success,
    false,
  );
  assert.equal(
    PlaceLookupRequestSchema.safeParse({ query: "Berlin", limit: 100 }).success,
    false,
  );
  assert.equal(
    normalizeDuffelPlace({
      id: "opaque",
      name: "Unknown",
      type: "city",
      iata_code: "XXX",
    }),
    null,
  );
});
test("existing result shape remains accepted and timeless journeys never become offers", () => {
  assert.equal(
    SearchResultSchema.safeParse({
      searchId: "s",
      state: "complete",
      createdAt: "2026-11-21T12:00:00Z",
      offers: [],
      warnings: [],
    }).success,
    true,
  );
  assert.equal(
    SearchResultSchema.safeParse({
      searchId: "s",
      state: "complete",
      createdAt: "2026-11-21T12:00:00Z",
      offers: [],
      warnings: [],
      timetableJourneys: [{ bookingSupported: true }],
    }).success,
    false,
  );
});
