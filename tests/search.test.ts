import { test } from "node:test";
import assert from "node:assert/strict";
import { search, getSearch } from "../packages/server/src/search";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
test("failed unconfigured search persists without fabricated offers and survives lookup", async () => {
  const old = process.env.DUFFEL_ACCESS_TOKEN;
  delete process.env.DUFFEL_ACCESS_TOKEN;
  const place = {
    id: "geonames:2950159",
    name: "Berlin",
    kind: "city" as const,
    countryCode: "DE",
    timeZone: "Europe/Berlin",
    providerIds: [{ provider: "geonames", id: "2950159" }],
    coordinates: { latitude: 52.52, longitude: 13.41 },
  };
  const intent = {
    version: 1 as const,
    origin: place,
    destination: { ...place, id: "destination", name: "Paris" },
    departureDate: "2030-01-01",
    returnDate: null,
    passengers: [{ id: "p1", age: 30, discounts: [] }],
    bags: { cabin: 0, checked: 0, bicycles: 0 },
    modes: ["flight" as const],
    preferences: {
      sort: "cheapest" as const,
      maxTransfers: null,
      accessible: null,
      cabin: null,
    },
    naturalLanguage: null,
  };
  const oldDatabase = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const receipt = await search(intent);
    const result = await getSearch(receipt.searchId);
    assert.equal(result.state, "failed");
    assert.deepEqual(result.offers, []);
    assert.equal(
      result.providerStatuses?.find((p) => p.provider === "duffel")?.status,
      "unconfigured",
    );
    await rm(
      resolve(
        process.cwd(),
        ".local",
        "wayward",
        "search",
        `${receipt.searchId}.json`,
      ),
    );
  } finally {
    if (old !== undefined) process.env.DUFFEL_ACCESS_TOKEN = old;
    if (oldDatabase !== undefined) process.env.DATABASE_URL = oldDatabase;
  }
});
