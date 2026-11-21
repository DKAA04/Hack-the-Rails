import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import {
  ensureDatabase,
  postgresPool,
  transaction,
  getRecord,
} from "../packages/server/src/db/records";
loadEnvFile("apps/web/.env.local");
async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log(
      JSON.stringify({
        capability: "supabase_transactions",
        status: "blocked_by_access",
        missing: "DATABASE_URL",
        developmentFileFallback: false,
      }),
    );
    return;
  }
  await ensureDatabase();
  const info = await postgresPool().query(
    "SELECT has_schema_privilege(current_user,'wayward_private','USAGE') AS schema_usage,has_schema_privilege(current_user,'wayward_private','CREATE') AS schema_create,(SELECT relrowsecurity FROM pg_class WHERE oid='wayward_private.records'::regclass) AS records_rls",
  );
  assert.equal(info.rows[0].schema_usage, true);
  assert.equal(info.rows[0].records_rls, true);
  const id = `verification-${randomUUID()}`;
  await transaction(async (records) => {
    await records.insert("search", id, { verification: true });
  });
  assert.deepEqual(await getRecord("search", id), { verification: true });
  const rollback = `verification-${randomUUID()}`;
  await assert.rejects(
    transaction(async (records) => {
      await records.insert("search", rollback, { verification: true });
      throw new Error("intentional rollback");
    }),
  );
  assert.equal(await getRecord("search", rollback), null);
  await assert.rejects(
    transaction(async (records) => {
      await records.insert("search", id, { duplicate: true });
    }),
  );
  assert.deepEqual(await getRecord("search", id), { verification: true });
  await postgresPool().query(
    "DELETE FROM wayward_private.records WHERE namespace='search' AND id=$1",
    [id],
  );
  console.log(
    JSON.stringify({
      capability: "supabase_transactions",
      status: "externally_verified",
      schemaUsage: true,
      schemaCreate: info.rows[0].schema_create,
      privateRecordsRls: true,
      commit: true,
      rollback: true,
      duplicateProtection: true,
      developmentFileFallback: false,
    }),
  );
}
main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        capability: "supabase_transactions",
        status: "failed",
        code: error.code ?? null,
        message:
          "Database verification failed. Check SQL credentials, private schema privileges and TLS.",
      }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL?.trim()) await postgresPool().end();
  });
