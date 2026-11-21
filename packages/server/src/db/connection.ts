import type { PoolConfig } from "pg";
import { ServiceError } from "../errors";
import { supabaseRootCertificate } from "./supabase-ca";
export function databaseConnectionOptions(value: string): PoolConfig {
  let url: URL;
  try {
    url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
  } catch {
    throw new ServiceError(
      "NOT_CONFIGURED",
      "DATABASE_URL must be a PostgreSQL connection URL.",
      503,
    );
  }
  const supabase =
    url.hostname.endsWith(".supabase.com") ||
    url.hostname.endsWith(".supabase.co");
  if (!supabase) return { connectionString: value };
  // Connection-string SSL parameters override pg's ssl object. Remove them for
  // Supabase so no URL setting can silently disable certificate verification.
  for (const key of [
    "ssl",
    "sslmode",
    "sslrootcert",
    "sslcert",
    "sslkey",
    "sslnegotiation",
    "uselibpqcompat",
  ])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: {
      ca: supabaseRootCertificate,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
  };
}
