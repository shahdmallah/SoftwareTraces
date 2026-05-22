require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const queries = [
  [
    "tables",
    `
      SELECT tablename
      FROM pg_tables
      WHERE tablename IN ('meetups', 'meetup_attendees', 'meetup_invites')
      ORDER BY tablename
    `,
  ],
  [
    "meetups_columns",
    `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'meetups'
      ORDER BY ordinal_position
    `,
  ],
  [
    "meetups_column_defaults",
    `
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'meetups'
      ORDER BY ordinal_position
    `,
  ],
  [
    "foreign_keys",
    `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('meetups', 'meetup_attendees', 'meetup_invites')
      ORDER BY tc.table_name, kcu.column_name
    `,
  ],
  [
    "indexes",
    `
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('meetups', 'meetup_attendees', 'meetup_invites')
      ORDER BY tablename, indexname
    `,
  ],
  [
    "follow_tables",
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('follows', 'user_follows')
      ORDER BY table_name
    `,
  ],
];

async function main() {
  for (const [name, sql] of queries) {
    const result = await pool.query(sql);
    console.log(`--- ${name} ---`);
    console.log(JSON.stringify(result.rows, null, 2));
  }
}

main()
  .catch((error) => {
    console.error("DB_DIAGNOSTIC_ERROR", error.code || "", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
