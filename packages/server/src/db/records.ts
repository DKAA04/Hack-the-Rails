import { Pool, type PoolClient } from "pg";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { configuration } from "../config";
import { ServiceError } from "../errors";
import { recordsMigration } from "./migrations/001-records";
export type RecordNamespace =
  | "search"
  | "quote"
  | "order"
  | "checkout"
  | "webhook";
let pool: Pool | undefined;
let initialized: Promise<void> | undefined;
export function postgresPool() {
  if (!process.env.DATABASE_URL?.trim())
    throw new ServiceError(
      "NOT_CONFIGURED",
      "DATABASE_URL is required for durable orders and payments.",
      503,
    );
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  return pool;
}
export async function ensureDatabase() {
  initialized ??= (async () => {
    const client = await postgresPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('wayward-private-migrations',0))",
      );
      await client.query(recordsMigration);
      await client.query("COMMIT");
    } catch {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw new ServiceError(
        "PROVIDER_UNAVAILABLE",
        "PostgreSQL private-schema migration failed. Verify database access and project schema permissions.",
        503,
        true,
      );
    } finally {
      client.release();
    }
  })().catch((error) => {
    initialized = undefined;
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(
      "PROVIDER_UNAVAILABLE",
      "PostgreSQL connection failed. Verify DATABASE_URL and TLS settings.",
      503,
      true,
    );
  });
  await initialized;
}
export interface RecordTransaction {
  lock(key: string): Promise<void>;
  get(
    namespace: RecordNamespace,
    id: string,
    forUpdate?: boolean,
  ): Promise<unknown | null>;
  insert(
    namespace: RecordNamespace,
    id: string,
    payload: unknown,
  ): Promise<void>;
  put(namespace: RecordNamespace, id: string, payload: unknown): Promise<void>;
}
function postgresTransaction(client: PoolClient): RecordTransaction {
  return {
    async lock(key) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [key],
      );
    },
    async get(namespace, id, forUpdate = false) {
      const result = await client.query(
        `SELECT payload FROM wayward_private.records WHERE namespace=$1 AND id=$2${forUpdate ? " FOR UPDATE" : ""}`,
        [namespace, id],
      );
      return result.rows[0]?.payload ?? null;
    },
    async insert(namespace, id, payload) {
      await client.query(
        "INSERT INTO wayward_private.records(namespace,id,payload) VALUES($1,$2,$3::jsonb)",
        [namespace, id, JSON.stringify(payload)],
      );
    },
    async put(namespace, id, payload) {
      await client.query(
        "INSERT INTO wayward_private.records(namespace,id,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(namespace,id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()",
        [namespace, id, JSON.stringify(payload)],
      );
    },
  };
}
export async function transaction<T>(
  run: (records: RecordTransaction) => Promise<T>,
): Promise<T> {
  await ensureDatabase();
  const client = await postgresPool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(postgresTransaction(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
function localPath(namespace: RecordNamespace, id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    throw new ServiceError("INVALID_REQUEST", "Invalid record ID.", 400);
  if (
    configuration().environment !== "development" ||
    !["search", "quote"].includes(namespace)
  )
    throw new ServiceError(
      "NOT_CONFIGURED",
      "Durable PostgreSQL storage is required for this operation.",
      503,
    );
  return join(
    resolve(process.cwd(), ".local", "wayward"),
    namespace,
    `${id}.json`,
  );
}
export async function putRecord(
  namespace: RecordNamespace,
  id: string,
  payload: unknown,
): Promise<void> {
  if (configuration().databaseConfigured) {
    await ensureDatabase();
    await postgresPool().query(
      "INSERT INTO wayward_private.records(namespace,id,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(namespace,id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()",
      [namespace, id, JSON.stringify(payload)],
    );
    return;
  }
  const path = localPath(namespace, id);
  await mkdir(resolve(path, ".."), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(payload), {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temp, path);
}
export async function getRecord(
  namespace: RecordNamespace,
  id: string,
): Promise<unknown | null> {
  if (configuration().databaseConfigured) {
    await ensureDatabase();
    const result = await postgresPool().query(
      "SELECT payload FROM wayward_private.records WHERE namespace=$1 AND id=$2",
      [namespace, id],
    );
    return result.rows[0]?.payload ?? null;
  }
  try {
    return JSON.parse(
      await readFile(localPath(namespace, id), "utf8"),
    ) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function databaseReachability(): Promise<
  "verified" | "failed" | "not_checked"
> {
  if (!configuration().databaseConfigured) return "not_checked";
  try {
    await postgresPool().query("SELECT 1");
    return "verified";
  } catch {
    return "failed";
  }
}
