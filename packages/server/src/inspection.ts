import { CapabilitiesSchema, HealthSchema } from "@wayward/contracts";
import { configuration, credentialsPresent } from "./config";
import { providers } from "./providers/registry";
export function health() {
  const c = configuration();
  return HealthSchema.parse({
    version: 1,
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: c.environment,
    configurationValid: c.valid,
    database: { configured: c.databaseConfigured, connectivity: "not_checked" },
  });
}
export function capabilities() {
  const c = configuration();
  return CapabilitiesSchema.parse({
    version: 1,
    environment: c.environment,
    providers: providers.map((p) => p.inspect()),
    payments: credentialsPresent("STRIPE_SECRET_KEY")
      ? "not_implemented"
      : "unconfigured",
    persistence: c.databaseConfigured ? "not_implemented" : "unconfigured",
    naturalLanguage: credentialsPresent("OPENAI_API_KEY")
      ? "not_implemented"
      : "unconfigured",
  });
}
