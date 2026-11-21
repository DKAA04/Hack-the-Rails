import type { ProviderAdapter } from "../types";
import { connectivity } from "../connectivity";
export const adapter: ProviderAdapter = {
  inspect: () => ({
    id: "public-transit",
    modes: ["rail", "local_transit", "walking", "transfer", "ferry"],
    credentialsPresent: null,
    connectivity: connectivity("public-transit"),
    operations: {
      search: "available",
      reprice: "unsupported",
      reserve: "unsupported",
      book: "unsupported",
      fulfillment: "unsupported",
      aftersales: "unsupported",
    },
    note: "Documented community VBB API; Berlin/Brandenburg timetables only, no saleable supplier offers, seat holds, payments or ticket issuance.",
  }),
};
