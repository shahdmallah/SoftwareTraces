import { pool } from "../db/pool";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function testDatabaseConnection(): Promise<{ success: boolean; message: string }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const client = await pool.connect();
      const result = await client.query("SELECT NOW() as time");
      client.release();

      return {
        success: true,
        message: `Connected to database at ${result.rows[0].time}`
      };
    } catch (error) {
      console.error(`Database connection attempt ${attempt} failed:`, error);

      if (attempt === MAX_RETRIES) {
        return {
          success: false,
          message: `Failed after ${MAX_RETRIES} attempts: ${(error as Error).message}`
        };
      }

      await sleep(RETRY_DELAY_MS);
    }
  }

  return { success: false, message: "Unknown error" };
}
