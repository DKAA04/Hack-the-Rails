import type { Itinerary } from "@wayward/contracts";
export interface JourneyComposer {
  compose(legs: Itinerary["legs"]): Promise<Itinerary[]>;
}
// Validate station/airport changes, local time zones, transfer buffers and protection before marking compatible.
