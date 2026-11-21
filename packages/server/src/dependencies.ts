import { DependencyHealthSchema } from "@wayward/contracts";
import { configuration, credentialsPresent } from "./config";
import { databaseReachability } from "./db/records";
export async function dependencies() {
  const config = configuration();
  return DependencyHealthSchema.parse({
    version: 1,
    checkoutPolicy: "per_order_test_only",
    database: {
      configured: config.databaseConfigured,
      connectivity: await databaseReachability(),
    },
    searchStorage: config.databaseConfigured
      ? "postgresql"
      : config.environment === "development"
        ? "development_file"
        : "unconfigured",
    stripe: {
      credentialsPresent: credentialsPresent("STRIPE_SECRET_KEY"),
      webhookSecretPresent: credentialsPresent("STRIPE_WEBHOOK_SECRET"),
      connectivity: "not_checked",
      checkoutEnabled: false,
    },
  });
}
