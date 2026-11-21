import { z } from "zod";
import {
  PlaceSchema,
  LegSchema,
  type Place,
  type SearchIntent,
  type Itinerary,
} from "@wayward/contracts";
import { supplierJson } from "../http";
import { ServiceError } from "../../errors";
import { composeLegs } from "../../routing/compose";
import { localToUtc } from "../../routing/time";
import { markConnectivity } from "../connectivity";
const Stop = z.object({
  id: z.string(),
  name: z.string(),
  location: z.object({ latitude: z.number(), longitude: z.number() }).nullish(),
});
const Leg = z.object({
  origin: Stop,
  destination: Stop,
  departure: z.string().nullable(),
  arrival: z.string().nullable(),
  walking: z.boolean().optional(),
  cancelled: z.boolean().optional(),
  tripId: z.string().optional(),
  line: z
    .object({
      product: z.string().optional(),
      name: z.string().optional(),
      operator: z.object({ name: z.string() }).optional(),
    })
    .optional(),
});
const Journeys = z.object({
  journeys: z.array(z.object({ legs: z.array(Leg) })),
});
function stopPlace(s: z.infer<typeof Stop>): Place {
  return PlaceSchema.parse({
    id: `vbb:${s.id}`,
    name: s.name,
    kind: "local_stop",
    countryCode: null,
    timeZone: "Europe/Berlin",
    providerIds: [{ provider: "vbb", id: s.id }],
    coordinates: s.location ?? null,
  });
}
export async function resolveVbbStop(place: Place): Promise<string> {
  const existing = place.providerIds.find((p) => p.provider === "vbb");
  if (existing) return existing.id;
  const c = place.coordinates;
  if (
    !c ||
    c.latitude < 51.3 ||
    c.latitude > 53.6 ||
    c.longitude < 11 ||
    c.longitude > 14.9
  )
    throw new ServiceError(
      "NOT_CONFIGURED",
      "VBB only covers Berlin/Brandenburg. Select a supported regional stop.",
      503,
    );
  const url = new URL("https://v6.vbb.transport.rest/locations/nearby");
  url.search = new URLSearchParams({
    latitude: String(c.latitude),
    longitude: String(c.longitude),
    results: "1",
    distance: "1500",
    poi: "false",
  }).toString();
  const stops = z.array(Stop).parse(await supplierJson(url));
  if (!stops[0])
    throw new ServiceError(
      "NOT_FOUND",
      "No regional stop found near the selected place.",
      404,
    );
  return stops[0].id;
}
export async function searchTransit(
  intent: SearchIntent,
): Promise<{ itineraries: Itinerary[]; warnings: string[] }> {
  if (intent.returnDate)
    throw new ServiceError(
      "NOT_IMPLEMENTED",
      "Regional timetable return searches are not implemented; search each direction separately.",
      501,
    );
  try {
    const [from, to] = await Promise.all([
      resolveVbbStop(intent.origin),
      resolveVbbStop(intent.destination),
    ]);
    const url = new URL("https://v6.vbb.transport.rest/journeys");
    url.search = new URLSearchParams({
      from,
      to,
      departure: localToUtc(
        `${intent.departureDate}T08:00:00`,
        intent.origin.timeZone,
      ),
      results: "5",
      remarks: "true",
      polylines: "false",
      suburban: String(
        intent.modes.includes("local_transit") || intent.modes.includes("rail"),
      ),
      subway: String(intent.modes.includes("local_transit")),
      tram: String(intent.modes.includes("local_transit")),
      bus: String(intent.modes.includes("local_transit")),
      ferry: String(intent.modes.includes("ferry")),
      express: String(intent.modes.includes("rail")),
      regional: String(intent.modes.includes("rail")),
      ...(intent.preferences.maxTransfers !== null
        ? { transfers: String(intent.preferences.maxTransfers) }
        : {}),
      ...(intent.preferences.accessible ? { accessibility: "complete" } : {}),
      bike: String(intent.bags.bicycles > 0),
    }).toString();
    const data = Journeys.parse(await supplierJson(url));
    const itineraries: Itinerary[] = [];
    let omitted = 0;
    for (const [i, journey] of data.journeys.entries()) {
      try {
        if (
          journey.legs.some((l) => !l.departure || !l.arrival || l.cancelled)
        ) {
          omitted++;
          continue;
        }
        const legs = journey.legs.map((l, j) =>
          LegSchema.parse({
            id: `vbb-${i}-${j}`,
            mode: l.walking
              ? "walking"
              : l.line?.product === "ferry"
                ? "ferry"
                : [
                      "regional",
                      "national",
                      "nationalExpress",
                      "express",
                    ].includes(l.line?.product ?? "")
                  ? "rail"
                  : "local_transit",
            origin: stopPlace(l.origin),
            destination: stopPlace(l.destination),
            departureUtc: new Date(l.departure!).toISOString(),
            arrivalUtc: new Date(l.arrival!).toISOString(),
            operator: l.line?.operator?.name ?? null,
            providerIds: l.tripId ? [{ provider: "vbb", id: l.tripId }] : [],
            timetableStatus: "scheduled",
            seatMapAvailable: null,
            crowding: "unknown",
          }),
        );
        // Walking connections may be required even when not a requested principal mode.
        if (
          legs.some(
            (l) => l.mode !== "walking" && !intent.modes.includes(l.mode),
          )
        ) {
          omitted++;
          continue;
        }
        const route = composeLegs(legs, `vbb-${crypto.randomUUID()}`);
        if (
          !intent.origin.providerIds.some((p) => p.provider === "vbb") ||
          !intent.destination.providerIds.some((p) => p.provider === "vbb")
        ) {
          route.completeness = "partial";
          route.missingConnections.push(
            "Access/egress from selected city coordinates to nearby stops is not priced or routed.",
          );
        }
        itineraries.push(route);
      } catch {
        omitted++;
      }
    }
    markConnectivity("public-transit", "verified");
    return {
      itineraries,
      warnings: [
        "VBB timetable journeys only: no supplier offer, fare, seat reservation or ticket. Regional departure search starts at 08:00 local time.",
        "Requested passenger discounts/baggage are not priced by this timetable source.",
        ...(omitted
          ? [
              `${omitted} incomplete, cancelled or incompatible journeys omitted.`,
            ]
          : []),
      ],
    };
  } catch (error) {
    markConnectivity("public-transit", "failed");
    throw error;
  }
}
