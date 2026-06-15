const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { Client } = require("pg");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("[db-test] DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    await client.connect();
    const result = await client.query("SELECT NOW() AS time");
    console.log(`[db-test] Connected to database at ${result.rows[0].time}`);
  } catch (error) {
    console.error("[db-test] Connection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
