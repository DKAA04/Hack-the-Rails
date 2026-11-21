import { z } from "zod";
import {
  PlaceLookupRequestSchema,
  PlaceLookupResponseSchema,
  PlaceSchema,
  type Place,
  type PlaceLookupRequest,
  type PlaceLookupSource,
} from "@wayward/contracts";
import { configuration, credentialsPresent } from "../config";
import { ServiceError } from "../errors";
import { supplierJson } from "../providers/http";
const GeoSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        country_code: z.string().optional(),
        timezone: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        feature_code: z.string().optional(),
      }),
    )
    .optional(),
});
const StopsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    location: z
      .object({ latitude: z.number(), longitude: z.number() })
      .nullish(),
  }),
);
export const DuffelPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["city", "airport"]),
  iata_code: z.string(),
  iata_country_code: z.string().nullish(),
  time_zone: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  airports: z.array(z.object({ time_zone: z.string().nullish() })).optional(),
});
export function normalizeDuffelPlace(
  raw: z.infer<typeof DuffelPlaceSchema>,
): Place | null {
  const zones = [
    ...new Set(raw.airports?.map((a) => a.time_zone).filter(Boolean)),
  ];
  const timeZone = raw.time_zone ?? (zones.length === 1 ? zones[0] : null);
  if (!timeZone) return null;
  const parsed = PlaceSchema.safeParse({
    id: `duffel:${raw.id}`,
    name: raw.name,
    kind: raw.type,
    countryCode: raw.iata_country_code ?? null,
    timeZone,
    providerIds: [
      { provider: "duffel", id: raw.id },
      { provider: "iata", id: raw.iata_code },
    ],
    coordinates:
      raw.latitude != null && raw.longitude != null
        ? { latitude: raw.latitude, longitude: raw.longitude }
        : null,
  });
  return parsed.success ? parsed.data : null;
}
export async function lookupPlaces(input: PlaceLookupRequest) {
  const request = PlaceLookupRequestSchema.parse(input);
  const config = configuration();
  if (!config.valid)
    throw new ServiceError(
      "NOT_CONFIGURED",
      "Invalid WAYWARD_ENV configuration.",
      503,
    );
  const sources: PlaceLookupSource[] = [];
  const warnings: string[] = [];
  const modes = request.modes;
  const includeTransit =
    !modes ||
    modes.some((m) =>
      ["rail", "local_transit", "walking", "transfer", "ferry"].includes(m),
    );
  const includeAir = !modes || modes.includes("flight");
  const jobs: { source: PlaceLookupSource; run: () => Promise<Place[]> }[] = [];
  const source = (
    id: string,
    attribution: string,
    url: string,
  ): PlaceLookupSource => ({
    id,
    status: "ok",
    message: null,
    attribution,
    url,
  });
  const geo = source(
    "open-meteo",
    "GeoNames via Open-Meteo (CC BY 4.0)",
    "https://open-meteo.com/en/docs/geocoding-api",
  );
  if (config.environment === "development")
    jobs.push({
      source: geo,
      run: async () => {
        const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
        url.search = new URLSearchParams({
          name: request.query,
          count: String(request.limit),
          language: "en",
          format: "json",
        }).toString();
        return (GeoSchema.parse(await supplierJson(url)).results ?? [])
          .filter((p) => p.feature_code?.startsWith("P"))
          .flatMap((p) => {
            const parsed = PlaceSchema.safeParse({
              id: `geonames:${p.id}`,
              name: p.name,
              kind: "city",
              countryCode: p.country_code ?? null,
              timeZone: p.timezone,
              providerIds: [{ provider: "geonames", id: String(p.id) }],
              coordinates: { latitude: p.latitude, longitude: p.longitude },
            });
            return parsed.success ? [parsed.data] : [];
          });
      },
    });
  else
    sources.push({
      ...geo,
      status: "unsupported",
      message:
        "Free geocoding is development-only; obtain a commercial licence before live use.",
    });
  const transit = source(
    "vbb",
    "VBB timetable data via community transport.rest; Berlin/Brandenburg coverage",
    "https://v6.vbb.transport.rest/api.html",
  );
  if (includeTransit)
    jobs.push({
      source: transit,
      run: async () => {
        const url = new URL("https://v6.vbb.transport.rest/locations");
        url.search = new URLSearchParams({
          query: request.query,
          results: String(request.limit),
          addresses: "false",
          poi: "false",
          language: "en",
        }).toString();
        return StopsSchema.parse(await supplierJson(url))
          .filter((p) => p.type === "stop" || p.type === "station")
          .map((p) =>
            PlaceSchema.parse({
              id: `vbb:${p.id}`,
              name: p.name,
              kind: "local_stop",
              countryCode: null,
              timeZone: "Europe/Berlin",
              providerIds: [{ provider: "vbb", id: p.id }],
              coordinates: p.location
                ? {
                    latitude: p.location.latitude,
                    longitude: p.location.longitude,
                  }
                : null,
            }),
          );
      },
    });
  const duffel = source(
    "duffel",
    "Duffel city and airport suggestions",
    "https://duffel.com/docs/api/v2/places/get-place-suggestions",
  );
  if (includeAir) {
    if (!credentialsPresent("DUFFEL_ACCESS_TOKEN"))
      sources.push({
        ...duffel,
        status: "unconfigured",
        message: "DUFFEL_ACCESS_TOKEN is missing; airport lookup disabled.",
      });
    else
      jobs.push({
        source: duffel,
        run: async () => {
          const url = new URL("https://api.duffel.com/places/suggestions");
          url.searchParams.set("query", request.query);
          const data = z
            .object({ data: z.array(DuffelPlaceSchema) })
            .parse(
              await supplierJson(url, {
                headers: {
                  Authorization: `Bearer ${process.env.DUFFEL_ACCESS_TOKEN}`,
                  "Duffel-Version": "v2",
                  Accept: "application/json",
                },
              }),
            );
          const places = data.data
            .map(normalizeDuffelPlace)
            .filter((p): p is Place => p !== null);
          if (places.length !== data.data.length)
            warnings.push(
              "Some Duffel places omitted because an IANA time zone was unavailable.",
            );
          return places;
        },
      });
  }
  const results = await Promise.allSettled(jobs.map((j) => j.run()));
  const places: Place[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    const job = jobs[i]!;
    if (result.status === "fulfilled") {
      sources.push(job.source);
      places.push(...result.value);
    } else
      sources.push({
        ...job.source,
        status: "unavailable",
        message: "Source unavailable or its response could not be validated.",
      });
  }
  if (!sources.some((s) => s.status === "ok"))
    throw new ServiceError(
      "PROVIDER_UNAVAILABLE",
      "No configured place source is reachable for these modes. Retry later or configure supplier access.",
      503,
      true,
    );
  // Round-robin sources so city matches cannot crowd actual stops/airports out of a short list.
  const buckets = jobs.map((j) =>
    places.filter((p) =>
      j.source.id === "open-meteo"
        ? p.id.startsWith("geonames:")
        : p.id.startsWith(`${j.source.id}:`),
    ),
  );
  const ordered: Place[] = [];
  for (let i = 0; i < request.limit; i++)
    for (const bucket of buckets) {
      if (bucket[i] && !ordered.some((p) => p.id === bucket[i]!.id))
        ordered.push(bucket[i]!);
    }
  return PlaceLookupResponseSchema.parse({
    version: 1,
    query: request.query,
    places: ordered.slice(0, request.limit),
    sources,
    warnings: [
      ...warnings,
      ...sources
        .filter((s) => s.status !== "ok")
        .map((s) => `${s.id}: ${s.message}`),
    ],
    fetchedAt: new Date().toISOString(),
  });
}
