import type { Mode, ProviderCapability } from "@wayward/contracts";
import { credentialsPresent } from "../config";
import type { ProviderAdapter } from "./types";
export function boundary(
  id: string,
  modes: Mode[],
  credentialNames: string[],
  note: string,
): ProviderAdapter {
  return {
    inspect(): ProviderCapability {
      const present = credentialNames.length
        ? credentialsPresent(...credentialNames)
        : null;
      return {
        id,
        modes,
        credentialsPresent: present,
        connectivity: "not_checked",
        operations: {
          search: "not_implemented",
          reprice: "not_implemented",
          reserve: "not_implemented",
          book: "not_implemented",
          fulfillment: "not_implemented",
          aftersales: "not_implemented",
        },
        note,
      };
    },
  };
}
