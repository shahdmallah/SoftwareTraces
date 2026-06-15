import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "./pool";

async function runSchema(): Promise<void> {
  const sql = await readFile(join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  const migrationsDir = join(__dirname, "migrations");
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => {
      if (left === "add_safety_system_tables.sql") return -1;
      if (right === "add_safety_system_tables.sql") return 1;
      return left.localeCompare(right);
    });

  for (const file of migrationFiles) {
    const migrationSql = await readFile(join(migrationsDir, file), "utf8");
    await pool.query(migrationSql);
    console.log(`Applied migration ${file}`);
  }

  await pool.end();
  console.log("Schema applied successfully.");
}

runSchema().catch((error) => {
  console.error("Failed to apply schema", error);
  process.exit(1);
});
