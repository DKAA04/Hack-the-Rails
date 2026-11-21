import type { Capabilities, DependencyHealth, Mode } from "@wayward/contracts";

export type CapabilityState =
  | "available"
  | "unconfigured"
  | "unverified"
  | "unsupported"
  | "not_implemented"
  | "unavailable";

export interface ModeAvailability {
  mode: Mode;
  /** Something can actually answer a search for this mode. */
  searchable: boolean;
  note: string;
}

export interface CapabilitiesView {
  environment: "development" | "live";
  naturalLanguage: CapabilityState;
  naturalLanguageConnected: boolean;
  payments: CapabilityState;
  paymentsConnected: boolean;
  /** Real account probe result; "test" means per-order test checkout only. */
  paymentEnvironment: "test" | "live" | "unknown" | null;
  paymentVerified: boolean;
  providers: {
    id: string;
    modes: Mode[];
    search: CapabilityState;
    connectivity: "not_checked" | "verified" | "failed";
    note: string;
  }[];
  modes: Record<Mode, ModeAvailability>;
}

// Public timetables have no capability entry with a search op, but the search
// service queries them for these modes (see API_CONTRACT search increment).
const TIMETABLE_MODES: Mode[] = ["rail", "local_transit", "ferry", "walking", "transfer"];

export function toCapabilitiesView(c: Capabilities): CapabilitiesView {
  const providers = c.providers.map((p) => ({
    id: p.id,
    modes: p.modes,
    search: (p.operations.search ?? "unsupported") as CapabilityState,
    connectivity: p.connectivity,
    note: p.note,
  }));
  const all: Mode[] = ["flight", "rail", "coach", "ferry", "local_transit", "walking", "transfer"];
  const modes = Object.fromEntries(
    all.map((mode) => {
      const offering = providers.filter(
        (p) => p.modes.includes(mode) && p.search === "available",
      );
      const timetable = TIMETABLE_MODES.includes(mode);
      return [
        mode,
        {
          mode,
          searchable: offering.length > 0 || timetable,
          note: offering.length
            ? "Prices from connected sellers"
            : timetable
              ? "Timetables only, no prices yet"
              : "No connected seller yet",
        },
      ];
    }),
  ) as Record<Mode, ModeAvailability>;
  return {
    environment: c.environment,
    naturalLanguage: c.naturalLanguage,
    naturalLanguageConnected: c.naturalLanguage === "available",
    payments: c.payments,
    paymentsConnected: c.payments === "available",
    paymentEnvironment: c.paymentProvider?.environment ?? null,
    paymentVerified: c.paymentProvider?.connectivity === "verified",
    providers,
    modes,
  };
}

export interface StorageView {
  label: string;
  tone: "ok" | "warn" | "danger" | "neutral";
  detail: string;
}
/** Order storage: configured is not reachable; only a verified probe counts. */
export function toStorageView(d: DependencyHealth): StorageView {
  if (!d.database.configured)
    return { label: "Not configured", tone: "warn", detail: "Orders can't be saved, so booking is off." };
  if (d.database.connectivity === "failed")
    return { label: "Unreachable", tone: "danger", detail: "The database didn't answer, so booking is off." };
  if (d.database.connectivity === "verified")
    return { label: "Connected", tone: "ok", detail: "Searches and orders are saved securely." };
  return { label: "Not checked", tone: "neutral", detail: "Configured, connection not verified yet." };
}
