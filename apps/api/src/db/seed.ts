import { pool } from "./pool";

async function seed(): Promise<void> {
  await pool.query(`
    INSERT INTO achievements (code, name, description, icon, points)
    VALUES
      ('FIRST_STEPS', 'First Steps', 'Complete your first hike', 'boot', 50),
      ('CLIMBER', 'Climber', 'Reach 1000m cumulative elevation gain', 'mountain', 150),
      ('EXPLORER', 'Explorer', 'Complete 10 hikes', 'compass', 200)
    ON CONFLICT (code) DO NOTHING;
  `);

  await pool.query(`
    INSERT INTO trails (
      slug, name, name_ar, description, region, difficulty, length_km,
      estimated_duration_min, elevation_gain_m, elevation_loss_m, tags,
      is_featured, start_point, end_point, geometry
    ) VALUES (
      'wadi-qelt-classic',
      'Wadi Qelt Classic',
      'وادي القلط',
      'A dramatic canyon route linking springs, monasteries, and desert views.',
      'Jericho',
      'moderate',
      12.4,
      240,
      520,
      515,
      ARRAY['canyon', 'spring', 'history'],
      TRUE,
      ST_SetSRID(ST_MakePoint(35.4392, 31.8667), 4326)::GEOGRAPHY,
      ST_SetSRID(ST_MakePoint(35.4603, 31.8351), 4326)::GEOGRAPHY,
      ST_SetSRID(ST_MakeLine(ARRAY[
        ST_MakePoint(35.4392, 31.8667),
        ST_MakePoint(35.4470, 31.8580),
        ST_MakePoint(35.4548, 31.8473),
        ST_MakePoint(35.4603, 31.8351)
      ]), 4326)::GEOGRAPHY
    )
    ON CONFLICT (slug) DO NOTHING;
  `);

  await pool.end();
  console.log("Seed completed.");
}

seed().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
