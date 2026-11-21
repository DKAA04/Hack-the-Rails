import { CapabilitiesSchema, HealthSchema } from "@wayward/contracts";
import { configuration, credentialsPresent } from "./config";
import { providers } from "./providers/registry";
import { stripeClient } from "./payments/stripe/client";
export function health() {
  const c = configuration();
  return HealthSchema.parse({
    version: 1,
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: c.environment,
    configurationValid: c.valid,
    database: {
      configured: c.databaseConfigured,
      connectivity: "not_checked",
    },
  });
}
let paymentProbe:
  | {
      key: string;
      at: number;
      value: {
        id: "stripe";
        credentialsPresent: boolean;
        connectivity: "not_checked" | "verified" | "failed";
        environment: "test" | "live" | "unknown";
      };
    }
  | undefined;
async function inspectPaymentProvider() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.trim())
    return {
      id: "stripe" as const,
      credentialsPresent: false,
      connectivity: "not_checked" as const,
      environment: "unknown" as const,
    };
  if (paymentProbe?.key === key && Date.now() - paymentProbe.at < 60000)
    return paymentProbe.value;
  let value: NonNullable<typeof paymentProbe>["value"];
  try {
    const balance = await stripeClient().balance.retrieve();
    value = {
      id: "stripe",
      credentialsPresent: true,
      connectivity: "verified",
      environment: balance.livemode ? "live" : "test",
    };
  } catch {
    value = {
      id: "stripe",
      credentialsPresent: true,
      connectivity: "failed",
      environment: "unknown",
    };
  }
  paymentProbe = { key, at: Date.now(), value };
  return value;
}
export async function capabilities() {
  const c = configuration();
  const paymentProvider = await inspectPaymentProvider();
  return CapabilitiesSchema.parse({
    version: 1,
    environment: c.environment,
    providers: providers.map((p) => p.inspect()),
    payments: !paymentProvider.credentialsPresent
      ? "unconfigured"
      : paymentProvider.connectivity === "verified" &&
          paymentProvider.environment === "test" &&
          c.environment === "development"
        ? "available"
        : "unavailable",
    paymentProvider,
    persistence:
      c.databaseConfigured || c.environment === "development"
        ? "available"
        : "unconfigured",
    naturalLanguage: credentialsPresent("OPENAI_API_KEY")
      ? "not_implemented"
      : "unconfigured",
  });
}
