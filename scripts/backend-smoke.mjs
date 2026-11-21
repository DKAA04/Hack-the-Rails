import assert from "node:assert/strict";
const base = process.env.SMOKE_URL || "http://localhost:3001";
async function lookup(query) {
  const r = await fetch(
    `${base}/api/places?query=${encodeURIComponent(query)}&limit=8&modes=local_transit`,
  );
  assert.equal(r.status, 200);
  const data = await r.json();
  const place = data.places.find((p) =>
    p.providerIds.some((id) => id.provider === "vbb"),
  );
  assert.ok(place, `Real VBB place for ${query}`);
  return place;
}
const [origin, destination] = await Promise.all([
  lookup("Alexanderplatz"),
  lookup("Potsdamer Platz"),
]);
const departureDate = new Date(Date.now() + 86400000)
  .toISOString()
  .slice(0, 10);
const intent = {
  version: 1,
  origin,
  destination,
  departureDate,
  returnDate: null,
  passengers: [{ id: "p1", age: 30, discounts: [] }],
  bags: { cabin: 0, checked: 0, bicycles: 0 },
  modes: ["local_transit", "walking"],
  preferences: {
    sort: "fastest",
    maxTransfers: 4,
    accessible: null,
    cabin: null,
  },
  naturalLanguage: null,
};
const created = await fetch(`${base}/api/search`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(intent),
});
assert.equal(created.status, 200);
const receipt = await created.json();
const read = await fetch(`${base}/api/search/${receipt.searchId}`);
assert.equal(read.status, 200);
const result = await read.json();
assert.equal(result.searchId, receipt.searchId);
assert.deepEqual(result.offers, []);
console.log(
  JSON.stringify({
    searchId: result.searchId,
    state: result.state,
    timetableJourneys: result.timetableJourneys?.length,
    providerStatuses: result.providerStatuses,
    warnings: result.warnings,
  }),
);
assert.ok(
  result.timetableJourneys.length > 0,
  "Source must return actual timetable journeys to claim live verification",
);
assert.ok(
  result.timetableJourneys.every(
    (j) =>
      j.bookingSupported === false &&
      j.price.kind === "unknown" &&
      j.availability === "unknown",
  ),
);
console.log(
  "PASS: actual places, live regional timetable routing, persisted results, and non-bookable/unknown-price invariants.",
);
