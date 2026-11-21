import { randomUUID } from "node:crypto";
import {
  ItinerarySchema,
  type Itinerary,
  type Leg,
  type Transfer,
} from "@wayward/contracts";
// A chronological candidate is not a supplier-protected connection. Unknown buffers remain unknown.
export function composeLegs(legs: Leg[], id: string = randomUUID()): Itinerary {
  const transfers: Transfer[] = [];
  for (let i = 1; i < legs.length; i++) {
    const before = legs[i - 1]!;
    const after = legs[i]!;
    const duration = Math.floor(
      (Date.parse(after.departureUtc) - Date.parse(before.arrivalUtc)) / 60000,
    );
    const same = before.destination.providerIds.some((p) =>
      after.origin.providerIds.some(
        (q) => q.provider === p.provider && q.id === p.id,
      ),
    );
    if (duration < 0) throw new Error("Overlapping itinerary legs");
    transfers.push({
      fromLegId: before.id,
      toLegId: after.id,
      durationMinutes: duration,
      minimumMinutes: null,
      protection: "unknown",
      changeLocation: !same,
      instructions: null,
      compatibility: "unverified",
    });
  }
  return ItinerarySchema.parse({
    id,
    legs,
    transfers,
    completeness: transfers.some((t) => t.changeLocation)
      ? "partial"
      : "complete",
    compatibility: legs.length === 1 ? "verified" : "unverified",
    missingConnections: transfers
      .filter((t) => t.changeLocation)
      .map(
        (t) => `Unresolved connection between ${t.fromLegId} and ${t.toLegId}`,
      ),
  });
}
export function combineItineraries(parts: Itinerary[]): Itinerary {
  return composeLegs(parts.flatMap((p) => p.legs));
}
