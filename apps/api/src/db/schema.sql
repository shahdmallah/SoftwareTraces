CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  home_region TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  total_distance_km NUMERIC NOT NULL DEFAULT 0,
  total_elevation_gain_m NUMERIC NOT NULL DEFAULT 0,
  total_activities INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (
    type IN (
      'follow',
      'review_like',
      'review_comment',
      'activity_like',
      'activity_comment',
      'meetup_invite',
      'meetup_join',
      'meetup_update',
      'sos_alert',
      'danger_alert',
      'achievement',
      'system'
    )
  ),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id)
WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS trails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT NOT NULL,
  description_ar TEXT,
  region TEXT NOT NULL,
  region_ar TEXT,
  difficulty TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  length_km NUMERIC NOT NULL,
  length_meters NUMERIC,
  estimated_duration_min INTEGER NOT NULL,
  estimated_duration_minutes INTEGER,
  elevation_gain_meters NUMERIC,
  elevation_gain_m NUMERIC NOT NULL DEFAULT 0,
  elevation_min NUMERIC NOT NULL DEFAULT 0,
  elevation_max NUMERIC NOT NULL DEFAULT 0,
  elevation_loss_m NUMERIC NOT NULL DEFAULT 0,
  rating NUMERIC NOT NULL DEFAULT 0,
  reviews INTEGER NOT NULL DEFAULT 0,
  average_rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  image TEXT,
  images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  features TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  features_ar TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  has_checkpoint BOOLEAN NOT NULL DEFAULT FALSE,
  checkpoint_note TEXT,
  hero_image_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'published',
  deleted_at TIMESTAMPTZ,
  start_point GEOGRAPHY(POINT, 4326) NOT NULL,
  end_point GEOGRAPHY(POINT, 4326) NOT NULL,
  geometry GEOGRAPHY(LINESTRING, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trail_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  photo_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE trails ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0;
ALTER TABLE trails ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS trail_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condition_type TEXT,
  severity TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'reported',
  note TEXT NOT NULL DEFAULT '',
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id UUID REFERENCES trails(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  elevation_gain_m NUMERIC NOT NULL DEFAULT 0,
  avg_speed_kph NUMERIC NOT NULL DEFAULT 0,
  max_speed_kph NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  matched_trail_confidence NUMERIC,
  route GEOGRAPHY(LINESTRING, 4326),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_points (
  id BIGSERIAL PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  elevation DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  speed_mps DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL,
  geom GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::GEOGRAPHY
  ) STORED
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS activity_likes (
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS activity_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_achievements (
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (achievement_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id UUID NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
  list_type TEXT NOT NULL DEFAULT 'favorites',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, trail_id, list_type)
);

CREATE INDEX IF NOT EXISTS idx_saved_trails_user ON saved_trails(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_trails_trail ON saved_trails(trail_id);

CREATE TABLE IF NOT EXISTS navigation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  trail_id UUID REFERENCES trails(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  off_trail_count INTEGER DEFAULT 0,
  total_off_trail_duration_seconds INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS off_trail_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  navigation_session_id UUID REFERENCES navigation_sessions(id) ON DELETE CASCADE,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  deviation_meters INTEGER,
  duration_seconds INTEGER,
  recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_profile_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET
    total_distance_km = COALESCE((SELECT SUM(distance_km) FROM activities WHERE user_id = NEW.user_id AND status = 'completed'), 0),
    total_elevation_gain_m = COALESCE((SELECT SUM(elevation_gain_m) FROM activities WHERE user_id = NEW.user_id AND status = 'completed'), 0),
    total_activities = COALESCE((SELECT COUNT(*) FROM activities WHERE user_id = NEW.user_id AND status = 'completed'), 0),
    updated_at = NOW()
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_trail_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE trails
  SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM trail_reviews
      WHERE trail_id = COALESCE(NEW.trail_id, OLD.trail_id)
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM trail_reviews
      WHERE trail_id = COALESCE(NEW.trail_id, OLD.trail_id)
    ),
    rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM trail_reviews
      WHERE trail_id = COALESCE(NEW.trail_id, OLD.trail_id)
    ),
    reviews = (
      SELECT COUNT(*)
      FROM trail_reviews
      WHERE trail_id = COALESCE(NEW.trail_id, OLD.trail_id)
    )
  WHERE id = COALESCE(NEW.trail_id, OLD.trail_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS trails_set_updated_at ON trails;
CREATE TRIGGER trails_set_updated_at BEFORE UPDATE ON trails
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS activities_set_updated_at ON activities;
CREATE TRIGGER activities_set_updated_at BEFORE UPDATE ON activities
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS activities_refresh_profile_stats ON activities;
CREATE TRIGGER activities_refresh_profile_stats
AFTER INSERT OR UPDATE ON activities
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE PROCEDURE refresh_profile_stats();

DROP TRIGGER IF EXISTS update_trail_rating_trigger ON trail_reviews;
CREATE TRIGGER update_trail_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON trail_reviews
FOR EACH ROW
EXECUTE PROCEDURE update_trail_rating();

UPDATE trails t
SET
  average_rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM trail_reviews
    WHERE trail_id = t.id
  ),
  total_reviews = (
    SELECT COUNT(*)
    FROM trail_reviews
    WHERE trail_id = t.id
  ),
  rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM trail_reviews
    WHERE trail_id = t.id
  ),
  reviews = (
    SELECT COUNT(*)
    FROM trail_reviews
    WHERE trail_id = t.id
  );

CREATE INDEX IF NOT EXISTS trails_start_point_idx ON trails USING GIST (start_point);
CREATE INDEX IF NOT EXISTS trails_geometry_idx ON trails USING GIST (geometry);
CREATE INDEX IF NOT EXISTS activities_route_idx ON activities USING GIST (route);
CREATE INDEX IF NOT EXISTS activity_points_geom_idx ON activity_points USING GIST (geom);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trail_id UUID REFERENCES trails(id) ON DELETE SET NULL,
  photo_id UUID,
  photo_type TEXT,
  media_id UUID,
  activity_media_id UUID,
  classification JSONB,
  language TEXT NOT NULL DEFAULT 'en',
  source TEXT NOT NULL DEFAULT 'google-ai',
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nature_sightings_trail ON nature_sightings(trail_id);
CREATE INDEX IF NOT EXISTS idx_nature_sightings_activity ON nature_sightings(activity_id);
CREATE INDEX IF NOT EXISTS idx_nature_sightings_photo ON nature_sightings(photo_type, photo_id);
CREATE INDEX IF NOT EXISTS idx_nature_sightings_media ON nature_sightings(media_id);
CREATE INDEX IF NOT EXISTS idx_nature_sightings_activity_media ON nature_sightings(activity_media_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nature_sightings_unique_photo
  ON nature_sightings(photo_type, photo_id)
  WHERE photo_type IS NOT NULL AND photo_id IS NOT NULL;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS activities_select ON activities;
CREATE POLICY activities_select ON activities FOR SELECT USING (TRUE);
