import { z } from "zod";
const EnvironmentSchema = z.enum(["development", "live"]);
export function configuration() {
  const parsed = EnvironmentSchema.safeParse(
    process.env.WAYWARD_ENV || "development",
  );
  return {
    environment: parsed.success ? parsed.data : ("development" as const),
    valid: parsed.success,
    databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
  };
}
export function credentialsPresent(...names: string[]) {
  return names.every((name) => Boolean(process.env[name]?.trim()));
}
