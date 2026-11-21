import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MoneySchema,
  PriceSchema,
  SearchIntentSchema,
} from "../packages/contracts/src/index";
test("money rejects floating point and unsafe integers", () => {
  assert.equal(
    MoneySchema.safeParse({ amount: 1.5, currency: "EUR" }).success,
    false,
  );
  assert.equal(
    MoneySchema.safeParse({
      amount: Number.MAX_SAFE_INTEGER + 1,
      currency: "EUR",
    }).success,
    false,
  );
});
test("unknown prices remain unknown; partial totals cannot claim completeness", () => {
  assert.deepEqual(PriceSchema.parse({ kind: "unknown" }), { kind: "unknown" });
  assert.equal(
    PriceSchema.safeParse({
      kind: "indicative",
      total: { amount: 100, currency: "EUR" },
      completeness: "complete",
      missingComponents: ["transfer"],
      breakdown: [],
      observedAt: "2026-11-21T10:00:00Z",
    }).success,
    false,
  );
  assert.equal(
    PriceSchema.safeParse({
      kind: "published_tariff_range",
      minimum: { amount: 200, currency: "EUR" },
      maximum: { amount: 100, currency: "EUR" },
      observedAt: "2026-11-21T10:00:00Z",
    }).success,
    false,
  );
});
test("search requires resolved places and explicit passenger ages", () => {
  assert.equal(
    SearchIntentSchema.safeParse({
      origin: "Paris",
      destination: "London",
      passengers: [{}],
    }).success,
    false,
  );
});
