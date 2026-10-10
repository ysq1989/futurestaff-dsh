import { readFile } from "node:fs/promises";
import type { Queryable } from "./repository.js";
export const migrations = [
  "001_initial.sql",
  "002_content.sql",
  "003_delivery_ledger.sql",
  "004_single_tenant_brand.sql",
  "005_ai_drafts.sql",
];
export async function migrate(
  db: Queryable & { exec(sql: string): Promise<unknown> },
) {
  const known = (
    await db.query<{ exists: string | null }>(
      "select to_regclass('public.geo_schema_versions') as exists",
    )
  ).rows[0].exists;
  const versions = known
    ? (
        await db.query<{ version: number }>(
          "select version from geo_schema_versions order by version",
        )
      ).rows.map((r) => r.version)
    : [];
  if (
    versions.some(
      (version, index) => version !== index + 1 || version > migrations.length,
    )
  )
    throw new Error("Unexpected GEO schema version sequence");
  for (let index = versions.length; index < migrations.length; index++) {
    try {
      await db.exec(
        await readFile(new URL(migrations[index], import.meta.url), "utf8"),
      );
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  }
  return migrations.length;
}
