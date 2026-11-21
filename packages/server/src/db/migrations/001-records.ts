export const recordsMigration = `
CREATE SCHEMA IF NOT EXISTS wayward_private;
CREATE TABLE IF NOT EXISTS wayward_private.records (
 namespace text NOT NULL, id text NOT NULL, payload jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(namespace,id)
);
ALTER TABLE wayward_private.records ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS wayward_private.schema_migrations (
 version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE wayward_private.schema_migrations ENABLE ROW LEVEL SECURITY;
INSERT INTO wayward_private.schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
`;
