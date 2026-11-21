import type { Place, PlaceLookupResponse } from "@wayward/contracts";

export type PlaceKind = Place["kind"];
export const PLACE_KIND_LABEL: Record<PlaceKind, string> = {
  city: "City",
  airport: "Airport",
  station: "Station",
  port: "Port",
  local_stop: "Local stop",
};

/**
 * A resolved place the user picked. `ref` is the untouched contract Place so
 * opaque providerIds and timeZone reach SearchIntent intact. Treat it as opaque.
 */
export interface PlaceOption {
  id: string;
  name: string;
  kind: PlaceKind;
  kindLabel: string;
  countryCode: string | null;
  countryName: string | null;
  timeZone: string;
  sources: string[];
  ref: Place;
}

export type SourceStatus = "ok" | "unconfigured" | "unavailable" | "unsupported";
export interface PlaceSourceView {
  id: string;
  status: SourceStatus;
  statusLabel: string;
  message: string | null;
  attribution: string;
  url: string;
}
export interface PlaceLookupView {
  query: string;
  options: PlaceOption[];
  sources: PlaceSourceView[];
  warnings: string[];
}

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export function countryName(code: string | null) {
  if (!code) return null;
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

const SOURCE_STATUS_LABEL: Record<SourceStatus, string> = {
  ok: "Answered",
  unconfigured: "Not configured",
  unavailable: "Unavailable",
  unsupported: "Not supported",
};

export function toPlaceOption(p: Place): PlaceOption {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    kindLabel: PLACE_KIND_LABEL[p.kind],
    countryCode: p.countryCode,
    countryName: countryName(p.countryCode),
    timeZone: p.timeZone,
    sources: [...new Set(p.providerIds.map((x) => x.provider))],
    ref: p,
  };
}

export function toPlaceLookupView(r: PlaceLookupResponse): PlaceLookupView {
  return {
    query: r.query,
    options: r.places.map(toPlaceOption),
    sources: r.sources.map((s) => ({
      id: s.id,
      status: s.status,
      statusLabel: SOURCE_STATUS_LABEL[s.status],
      message: s.message,
      attribution: s.attribution,
      url: s.url,
    })),
    warnings: r.warnings,
  };
}
