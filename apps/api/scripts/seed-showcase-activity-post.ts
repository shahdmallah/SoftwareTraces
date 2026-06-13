import * as poolModule from "../src/db/pool.ts";

const pool =
  "pool" in poolModule
    ? poolModule.pool
    : (poolModule as { default?: { pool?: typeof poolModule.pool } }).default?.pool;

if (!pool) {
  throw new Error("Unable to load database pool from ../src/db/pool.ts");
}

const SHOWCASE_ACTIVITY_NAME = "Codex Showcase Activity Post";
const SHOWCASE_ACTIVITY_NOTES = JSON.stringify({
  summary: "Seeded showcase activity post for activity page QA.",
  stepCount: 16842,
});
const SHOWCASE_POST_CAPTION =
  "Sunrise start, canyon shade by mid-morning, and enough detail in this post to exercise the full activity recap UI.";

const POSTER_USER_ID = "15d7d87c-1cd1-47d0-9a5b-bdb1d87c04d5"; // Shahd mallah
const SUPPORTER_USER_IDS = [
  "4a696020-884f-4d3f-8109-d2963e095df6", // Zaina Hanini
  "c68334aa-6861-4436-b6f0-b4ef177bd055", // hazim hanini
];
const TRAIL_ID = "1302fd1a-1892-4918-a549-ac836bece979"; // Wadi Al-Makhrour Valley

const START_TIME = "2026-06-11T04:45:00.000Z";
const END_TIME = "2026-06-11T09:32:00.000Z";
const PAUSE_DURATION_SEC = 960;

const photoSeeds = [
  {
    storagePath: "seed/showcase-activity-post/lookout.jpg",
    publicUrl:
      "https://rvbyxhpaukuelwkwstiw.supabase.co/storage/v1/object/public/activity-media/0829dad2-46b1-4c43-bf55-8181af77ae79/0d8a691e-608e-46a5-9478-aff2ad601aba.jpg",
    caption: "First overlook after the warmup climb.",
    latitude: 31.7151,
    longitude: 35.1479,
    capturedAt: "2026-06-11T05:18:00.000Z",
    helpfulScore: 8,
    qualityScore: 92,
    classification: {
      scene: "lookout",
      mood: "sunrise",
      features: ["valley", "ridge", "soft-light"],
    },
  },
  {
    storagePath: "seed/showcase-activity-post/wildflowers.jpg",
    publicUrl:
      "https://rvbyxhpaukuelwkwstiw.supabase.co/storage/v1/object/public/activity-media/0829dad2-46b1-4c43-bf55-8181af77ae79/8a580417-a242-47ea-8f2b-2bdad72b0bcf.jpg",
    caption: "Wildflowers near the spring crossing.",
    latitude: 31.7108,
    longitude: 35.1542,
    capturedAt: "2026-06-11T06:41:00.000Z",
    helpfulScore: 11,
    qualityScore: 95,
    classification: {
      scene: "spring-crossing",
      mood: "lush",
      features: ["flowers", "water", "shade"],
    },
  },
  {
    storagePath: "seed/showcase-activity-post/finish.jpg",
    publicUrl:
      "https://rvbyxhpaukuelwkwstiw.supabase.co/storage/v1/object/public/activity-media/0829dad2-46b1-4c43-bf55-8181af77ae79/f573a29a-7be5-4efd-b255-92cf3406ae4d.jpg",
    caption: "Last ridge before heading back down.",
    latitude: 31.7072,
    longitude: 35.1604,
    capturedAt: "2026-06-11T08:54:00.000Z",
    helpfulScore: 6,
    qualityScore: 88,
    classification: {
      scene: "final-ridge",
      mood: "clear",
      features: ["ridge", "descent", "panorama"],
    },
  },
];

const pointSeeds = [
  { sequence: 1, latitude: 31.7162, longitude: 35.1455, elevation: 618, accuracy: 8, speed: 1.2, heading: 112, timestamp: "2026-06-11T04:45:00.000Z" },
  { sequence: 2, latitude: 31.7153, longitude: 35.1484, elevation: 672, accuracy: 7, speed: 1.5, heading: 124, timestamp: "2026-06-11T05:16:00.000Z" },
  { sequence: 3, latitude: 31.7114, longitude: 35.1526, elevation: 721, accuracy: 6, speed: 1.4, heading: 138, timestamp: "2026-06-11T06:02:00.000Z" },
  { sequence: 4, latitude: 31.7097, longitude: 35.1571, elevation: 802, accuracy: 6, speed: 1.1, heading: 151, timestamp: "2026-06-11T07:24:00.000Z" },
  { sequence: 5, latitude: 31.7072, longitude: 35.1604, elevation: 846, accuracy: 5, speed: 0.9, heading: 167, timestamp: "2026-06-11T08:54:00.000Z" },
];

const commentSeeds = [
  {
    userId: SUPPORTER_USER_IDS[0],
    content: "This is exactly the kind of activity post that makes the trail feel alive.",
    createdAt: "2026-06-11T10:05:00.000Z",
  },
  {
    userId: SUPPORTER_USER_IDS[1],
    content: "The photo sequence and the stats together look really strong here.",
    createdAt: "2026-06-11T10:22:00.000Z",
  },
  {
    userId: SUPPORTER_USER_IDS[0],
    content: "Love the nature sightings tie-in too. It gives the recap a lot more personality.",
    createdAt: "2026-06-11T10:44:00.000Z",
  },
];

async function main(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingActivitiesResult = await client.query<{ id: string }>(
      `
      SELECT id
      FROM activities
      WHERE user_id = $1::uuid
        AND name = $2
      `,
      [POSTER_USER_ID, SHOWCASE_ACTIVITY_NAME]
    );

    const existingActivityIds = existingActivitiesResult.rows.map((row) => row.id);

    if (existingActivityIds.length > 0) {
      const existingMediaResult = await client.query<{ id: string }>(
        `
        SELECT id
        FROM activity_media
        WHERE activity_id = ANY($1::uuid[])
        `,
        [existingActivityIds]
      );

      const existingMediaIds = existingMediaResult.rows.map((row) => row.id);

      if (existingMediaIds.length > 0) {
        await client.query(
          `
          DELETE FROM nature_sightings
          WHERE activity_id = ANY($1::uuid[])
             OR activity_media_id = ANY($2::uuid[])
             OR (photo_type = 'activity_media' AND photo_id = ANY($2::uuid[]))
          `,
          [existingActivityIds, existingMediaIds]
        );
      } else {
        await client.query("DELETE FROM nature_sightings WHERE activity_id = ANY($1::uuid[])", [existingActivityIds]);
      }

      await client.query("DELETE FROM activity_comments WHERE activity_id = ANY($1::uuid[])", [existingActivityIds]);
      await client.query("DELETE FROM activity_likes WHERE activity_id = ANY($1::uuid[])", [existingActivityIds]);
      await client.query("DELETE FROM activity_points WHERE activity_id = ANY($1::uuid[])", [existingActivityIds]);
      await client.query("DELETE FROM activity_events WHERE activity_id = ANY($1::uuid[])", [existingActivityIds]);
      await client.query("DELETE FROM activity_media WHERE activity_id = ANY($1::uuid[])", [existingActivityIds]);
      await client.query("DELETE FROM activity_posts WHERE activity_id = ANY($1::uuid[])", [existingActivityIds]);
      await client.query("DELETE FROM activities WHERE id = ANY($1::uuid[])", [existingActivityIds]);
    }

    const activityResult = await client.query<{ id: string }>(
      `
      INSERT INTO activities (
        user_id,
        trail_id,
        name,
        activity_type,
        notes,
        is_public,
        start_time,
        end_time,
        elapsed_time_seconds,
        moving_time_seconds,
        distance_meters,
        elevation_gain_meters,
        elevation_loss_meters,
        max_elevation_meters,
        min_elevation_meters,
        average_pace_seconds_per_km,
        max_speed_mps,
        avg_speed_mps,
        calories_burned,
        featured_photo_url,
        is_synced,
        is_deleted,
        created_at,
        updated_at,
        paused_duration_sec,
        visibility,
        client_started_at,
        client_finished_at,
        status
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3,
        'hike',
        $4,
        true,
        $5::timestamptz,
        $6::timestamptz,
        17220,
        16260,
        12840,
        640,
        615,
        912,
        544,
        804,
        2.6,
        1.42,
        1180,
        $7,
        true,
        false,
        NOW(),
        NOW(),
        $8,
        'public',
        $5::timestamptz,
        $6::timestamptz,
        'completed'
      )
      RETURNING id
      `,
      [
        POSTER_USER_ID,
        TRAIL_ID,
        SHOWCASE_ACTIVITY_NAME,
        SHOWCASE_ACTIVITY_NOTES,
        START_TIME,
        END_TIME,
        photoSeeds[0].publicUrl,
        PAUSE_DURATION_SEC,
      ]
    );

    const activityId = activityResult.rows[0].id;

    await client.query(
      `
      INSERT INTO activity_events (activity_id, event_type, occurred_at, metadata)
      VALUES
        ($1::uuid, 'started', $2::timestamptz, NULL),
        ($1::uuid, 'paused', '2026-06-11T06:18:00.000Z'::timestamptz, '{"pause_started_at":"2026-06-11T06:18:00.000Z"}'::jsonb),
        ($1::uuid, 'resumed', '2026-06-11T06:34:00.000Z'::timestamptz, '{"pause_started_at":"2026-06-11T06:18:00.000Z","pause_duration_sec":960}'::jsonb),
        ($1::uuid, 'completed', $3::timestamptz, '{"distance_meters":12840,"elapsed_time_seconds":17220}'::jsonb)
      `,
      [activityId, START_TIME, END_TIME]
    );

    for (const point of pointSeeds) {
      await client.query(
        `
        INSERT INTO activity_points (
          activity_id,
          sequence,
          latitude,
          longitude,
          elevation_meters,
          accuracy_meters,
          speed_mps,
          heading_degrees,
          timestamp,
          created_at
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, NOW())
        `,
        [
          activityId,
          point.sequence,
          point.latitude,
          point.longitude,
          point.elevation,
          point.accuracy,
          point.speed,
          point.heading,
          point.timestamp,
        ]
      );
    }

    const postResult = await client.query<{ id: string }>(
      `
      INSERT INTO activity_posts (activity_id, user_id, review_id, caption, visibility, created_at)
      VALUES ($1::uuid, $2::uuid, NULL, $3, 'public', NOW())
      RETURNING id
      `,
      [activityId, POSTER_USER_ID, SHOWCASE_POST_CAPTION]
    );

    const postId = postResult.rows[0].id;
    const mediaIds: string[] = [];

    for (const photo of photoSeeds) {
      const mediaResult = await client.query<{ id: string }>(
        `
        INSERT INTO activity_media (
          activity_id,
          user_id,
          trail_id,
          media_type,
          storage_path,
          public_url,
          caption,
          latitude,
          longitude,
          captured_at,
          created_at,
          approved_for_trail_page,
          helpful_score,
          flag_count,
          quality_score,
          ai_classification,
          ai_verified_at,
          manual_review_required
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          'photo',
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::timestamptz,
          NOW(),
          true,
          $10,
          0,
          $11,
          $12::jsonb,
          NOW(),
          false
        )
        RETURNING id
        `,
        [
          activityId,
          POSTER_USER_ID,
          TRAIL_ID,
          photo.storagePath,
          photo.publicUrl,
          photo.caption,
          photo.latitude,
          photo.longitude,
          photo.capturedAt,
          photo.helpfulScore,
          photo.qualityScore,
          JSON.stringify(photo.classification),
        ]
      );

      mediaIds.push(mediaResult.rows[0].id);
    }

    await client.query(
      `
      INSERT INTO nature_sightings (
        activity_id,
        user_id,
        latitude,
        longitude,
        category,
        species,
        common_name,
        confidence,
        photo_url,
        created_at,
        trail_id,
        photo_id,
        photo_type,
        media_id,
        activity_media_id,
        classification,
        language,
        source,
        updated_at
      )
      VALUES
        (
          $1::uuid,
          $2::uuid,
          31.7151,
          35.1479,
          'animal',
          'Falco tinnunculus',
          'Common kestrel',
          0.93,
          $3,
          NOW(),
          $4::uuid,
          $5::uuid,
          'activity_media',
          NULL,
          $5::uuid,
          $6::jsonb,
          'en',
          'seed-script',
          NOW()
        ),
        (
          $1::uuid,
          $2::uuid,
          31.7108,
          35.1542,
          'plant',
          'Anemone coronaria',
          'Crown anemone',
          0.89,
          $7,
          NOW(),
          $4::uuid,
          $8::uuid,
          'activity_media',
          NULL,
          $8::uuid,
          $9::jsonb,
          'en',
          'seed-script',
          NOW()
        )
      `,
      [
        activityId,
        POSTER_USER_ID,
        photoSeeds[0].publicUrl,
        TRAIL_ID,
        mediaIds[0],
        JSON.stringify({
          commonName: "Common kestrel",
          scientificName: "Falco tinnunculus",
          confidenceLevel: 93,
          shortDescription: "A small falcon often seen hovering above open valleys while hunting.",
          notableFeatures: ["pointed wings", "hovering flight", "warm brown plumage"],
        }),
        photoSeeds[1].publicUrl,
        mediaIds[1],
        JSON.stringify({
          commonName: "Crown anemone",
          scientificName: "Anemone coronaria",
          confidenceLevel: 89,
          shortDescription: "A spring wildflower that adds bright red patches to Mediterranean hillsides.",
          notableFeatures: ["wide petals", "dark center", "seasonal bloom"],
        }),
      ]
    );

    for (const userId of SUPPORTER_USER_IDS) {
      await client.query(
        `
        INSERT INTO activity_likes (activity_id, user_id, created_at)
        VALUES ($1::uuid, $2::uuid, NOW())
        `,
        [activityId, userId]
      );
    }

    for (const comment of commentSeeds) {
      await client.query(
        `
        INSERT INTO activity_comments (activity_id, user_id, content, created_at, updated_at)
        VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz, $4::timestamptz)
        `,
        [activityId, comment.userId, comment.content, comment.createdAt]
      );
    }

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          ok: true,
          activityId,
          postId,
          posterUserId: POSTER_USER_ID,
          trailId: TRAIL_ID,
          mediaIds,
          inserted: {
            activityPosts: 1,
            activityMedia: mediaIds.length,
            activityPoints: pointSeeds.length,
            natureSightings: 2,
            activityLikes: SUPPORTER_USER_IDS.length,
            activityComments: commentSeeds.length,
          },
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed showcase activity post.");
  console.error(error);
  process.exit(1);
});
