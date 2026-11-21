import { Pool, type PoolClient } from "pg";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { configuration } from "../config";
import { ServiceError } from "../errors";
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
  initialized ??= postgresPool()
    .query(
      `CREATE TABLE IF NOT EXISTS wayward_records (namespace text NOT NULL, id text NOT NULL, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(namespace,id))`,
    )
    .then(() => undefined)
    .catch(() => {
      initialized = undefined;
      throw new ServiceError(
        "PROVIDER_UNAVAILABLE",
        "PostgreSQL is unavailable or schema initialization was denied.",
        503,
        true,
      );
    });
  await initialized;
}
export async function transaction<T>(
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  await ensureDatabase();
  const client = await postgresPool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
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
      "INSERT INTO wayward_records(namespace,id,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(namespace,id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()",
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
      "SELECT payload FROM wayward_records WHERE namespace=$1 AND id=$2",
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
