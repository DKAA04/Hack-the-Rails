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
        reserve: configured ? "available" : "unconfigured",
        book: "not_implemented",
        fulfillment: configured ? "available" : "unconfigured",
        aftersales: "not_implemented",
      },
      note: "Test-only order workflow supports offer-specific unpaid holds, sandbox balance settlement and actual supplier document retrieval. Instant/live purchases and aftersales are disabled. Credential presence is distinct from verified connectivity.",
    };
  },
  search: async (intent) => (await searchFlights(intent)).offers,
};
