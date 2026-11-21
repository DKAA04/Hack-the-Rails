import { credentialsPresent } from "../../config";
import { connectivity } from "../connectivity";
import { searchFlights } from "./search";
import type { ProviderAdapter } from "../types";
export const adapter: ProviderAdapter = {
  inspect: () => {
    const configured = credentialsPresent("DUFFEL_ACCESS_TOKEN");
    return {
      id: "duffel",
      modes: ["flight"],
      credentialsPresent: configured,
      connectivity: connectivity("duffel"),
      operations: {
        search: configured ? "available" : "unconfigured",
        reprice: configured ? "available" : "unconfigured",
        reserve: "not_implemented",
        book: "not_implemented",
        fulfillment: "not_implemented",
        aftersales: "not_implemented",
      },
      note: "Search/reprice implemented against documented Duffel v2 API. Connectivity is verified only after a validated response; booking is disabled.",
    };
  },
  search: async (intent) => (await searchFlights(intent)).offers,
};
