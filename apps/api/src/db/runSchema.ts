import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pool } from "./pool";

async function runSchema(): Promise<void> {
  const sql = await readFile(join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  await pool.end();
  console.log("Schema applied successfully.");
}

runSchema().catch((error) => {
  console.error("Failed to apply schema", error);
  process.exit(1);
});
