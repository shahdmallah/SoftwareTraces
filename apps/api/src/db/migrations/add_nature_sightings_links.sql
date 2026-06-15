CREATE TABLE IF NOT EXISTS nature_sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  category TEXT,
  species TEXT,
  common_name TEXT,
  confidence NUMERIC,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nature_sightings ADD COLUMN IF NOT EXISTS trail_id UUID REFERENCES trails(id) ON DELETE SET NULL;
ALTER TABLE nature_sightings ADD COLUMN IF NOT EXISTS photo_id UUID;
ALTER TABLE nature_sightings ADD COLUMN IF NOT EXISTS photo_type TEXT;
ALTER TABLE nature_sightings ADD COLUMN IF NOT EXISTS media_id UUID;
ALTER TABLE nature_sightings ADD COLUMN IF NOT EXISTS activity_media_id UUID;
ALTER TABLE nature_sightings ADD COLUMN IF NOT EXISTS classification JSONB;
ALTER TABLE nature_sightings ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE nature_sightings ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'google-ai';
ALTER TABLE nature_sightings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE nature_sightings
SET media_id = photo_id
WHERE photo_type = 'media'
  AND photo_id IS NOT NULL
  AND media_id IS NULL;

UPDATE nature_sightings
SET activity_media_id = photo_id
WHERE photo_type = 'activity_media'
  AND photo_id IS NOT NULL
  AND activity_media_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_nature_sightings_trail ON nature_sightings(trail_id);
CREATE INDEX IF NOT EXISTS idx_nature_sightings_activity ON nature_sightings(activity_id);
CREATE INDEX IF NOT EXISTS idx_nature_sightings_photo ON nature_sightings(photo_type, photo_id);
CREATE INDEX IF NOT EXISTS idx_nature_sightings_media ON nature_sightings(media_id);
CREATE INDEX IF NOT EXISTS idx_nature_sightings_activity_media ON nature_sightings(activity_media_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nature_sightings_unique_photo
  ON nature_sightings(photo_type, photo_id)
  WHERE photo_type IS NOT NULL AND photo_id IS NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.media') IS NOT NULL THEN
    ALTER TABLE nature_sightings
      DROP CONSTRAINT IF EXISTS fk_nature_sightings_media;
    ALTER TABLE nature_sightings
      ADD CONSTRAINT fk_nature_sightings_media
      FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.activity_media') IS NOT NULL THEN
    ALTER TABLE nature_sightings
      DROP CONSTRAINT IF EXISTS fk_nature_sightings_activity_media;
    ALTER TABLE nature_sightings
      ADD CONSTRAINT fk_nature_sightings_activity_media
      FOREIGN KEY (activity_media_id) REFERENCES activity_media(id) ON DELETE SET NULL;
  END IF;
END $$;
