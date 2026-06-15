CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id uuid;
UPDATE public.profiles SET id = user_id WHERE id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_id_unique ON public.profiles(id);

CREATE TABLE IF NOT EXISTS public.sos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  message text,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'notifying', 'notified', 'acknowledged', 'resolved', 'cancelled', 'failed')),
  status_note text,
  contact_count integer NOT NULL DEFAULT 0,
  notified_contact_count integer NOT NULL DEFAULT 0,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sos_events_user_created_idx ON public.sos_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sos_events_status_idx ON public.sos_events(status);

ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS status_note text;
ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS contact_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS notified_contact_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS failed_at timestamptz;
ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  relationship text,
  priority integer NOT NULL DEFAULT 1,
  notify_by_sms boolean NOT NULL DEFAULT true,
  notify_by_email boolean NOT NULL DEFAULT true,
  notify_by_push boolean NOT NULL DEFAULT true,
  notify_on_sos boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (phone IS NOT NULL OR email IS NOT NULL OR contact_user_id IS NOT NULL OR notify_by_push = true)
);

CREATE INDEX IF NOT EXISTS emergency_contacts_user_priority_idx ON public.emergency_contacts(user_id, is_active, priority);
CREATE INDEX IF NOT EXISTS emergency_contacts_contact_user_idx ON public.emergency_contacts(contact_user_id) WHERE contact_user_id IS NOT NULL;

ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS contact_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.emergency_contacts ADD COLUMN IF NOT EXISTS notify_on_sos boolean NOT NULL DEFAULT true;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.emergency_contacts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%phone%'
      AND pg_get_constraintdef(oid) ILIKE '%email%'
      AND pg_get_constraintdef(oid) ILIKE '%notify_by_push%'
  LOOP
    EXECUTE format('ALTER TABLE public.emergency_contacts DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.emergency_contacts
  ADD CONSTRAINT emergency_contacts_reachable_check
  CHECK (phone IS NOT NULL OR email IS NOT NULL OR contact_user_id IS NOT NULL OR notify_by_push = true);

CREATE TABLE IF NOT EXISTS public.sos_contact_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_event_id uuid NOT NULL REFERENCES public.sos_events(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.emergency_contacts(id) ON DELETE CASCADE,
  recipient_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  conversation_id uuid,
  message_id uuid,
  channel text NOT NULL CHECK (channel IN ('sms', 'email', 'push', 'in_app_message')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sos_event_id, contact_id, channel)
);

CREATE TABLE IF NOT EXISTS public.dangerous_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text,
  location_type text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  danger_radius_meters numeric NOT NULL DEFAULT 300,
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  operating_hours text,
  description text,
  description_ar text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  geom geography(point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
  ) STORED
);

CREATE INDEX IF NOT EXISTS dangerous_locations_geom_idx ON public.dangerous_locations USING gist(geom);
CREATE INDEX IF NOT EXISTS dangerous_locations_active_type_idx ON public.dangerous_locations(is_active, location_type);

CREATE TABLE IF NOT EXISTS public.safety_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  description text,
  headline text,
  source text NOT NULL DEFAULT 'user',
  source_name text,
  source_url text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  confirmed_count integer NOT NULL DEFAULT 0,
  reporter_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  moderation_status text NOT NULL DEFAULT 'active' CHECK (moderation_status IN ('pending', 'active', 'rejected', 'resolved', 'expired')),
  moderation_note text,
  moderated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  geom geography(point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
  ) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS safety_incidents_source_dedupe_idx
  ON public.safety_incidents(source, source_url, headline, reported_at)
  WHERE source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS safety_incidents_active_idx ON public.safety_incidents(is_resolved, expires_at, moderation_status);
CREATE INDEX IF NOT EXISTS safety_incidents_geom_idx ON public.safety_incidents USING gist(geom);

ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS moderation_note text;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS moderated_at timestamptz;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.safety_incidents ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.trail_safety_scores (
  trail_id uuid PRIMARY KEY REFERENCES public.trails(id) ON DELETE CASCADE,
  safety_score numeric NOT NULL,
  risk_level text NOT NULL,
  nearest_settlement_name text,
  nearest_settlement_distance_meters numeric,
  nearest_checkpoint_name text,
  nearest_checkpoint_distance_meters numeric,
  incident_count_48h integer NOT NULL DEFAULT 0,
  last_calculated timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trail_safety_scores_last_calculated_idx ON public.trail_safety_scores(last_calculated);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  entity_type text,
  entity_id uuid,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_danger_id_idx ON public.notifications((data->>'danger_id')) WHERE type = 'danger_alert';

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  provider text NOT NULL DEFAULT 'expo' CHECK (provider IN ('expo', 'fcm', 'apns', 'webpush')),
  device_id text,
  app_version text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS push_tokens_user_token_idx ON public.push_tokens(user_id, token);
CREATE INDEX IF NOT EXISTS push_tokens_user_active_idx ON public.push_tokens(user_id, is_active);
CREATE INDEX IF NOT EXISTS push_tokens_user_fcm_active_idx
  ON public.push_tokens(user_id)
  WHERE provider = 'fcm' AND is_active = true;

ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'expo';
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS app_version text;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.access_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL UNIQUE REFERENCES public.trails(id) ON DELETE CASCADE,
  trailhead_latitude numeric NOT NULL,
  trailhead_longitude numeric NOT NULL,
  trailhead_name text NOT NULL DEFAULT 'Main trailhead',
  trailhead_name_ar text,
  trailhead_parking_notes text,
  trailhead_parking_notes_ar text,
  trailhead_access_notes text,
  trailhead_access_notes_ar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS access_routes_trail_idx ON public.access_routes(trail_id);

CREATE TABLE IF NOT EXISTS public.news_fetch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  articles_processed integer NOT NULL DEFAULT 0,
  incidents_created integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offline_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trail_id uuid NOT NULL REFERENCES public.trails(id) ON DELETE CASCADE,
  downloaded_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offline_maps_user_idx ON public.offline_maps(user_id);
CREATE INDEX IF NOT EXISTS offline_maps_trail_idx ON public.offline_maps(trail_id);

ALTER TABLE public.sos_contact_notifications ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.sos_contact_notifications ADD COLUMN IF NOT EXISTS conversation_id uuid;
ALTER TABLE public.sos_contact_notifications ADD COLUMN IF NOT EXISTS message_id uuid;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.sos_contact_notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%channel%'
  LOOP
    EXECUTE format('ALTER TABLE public.sos_contact_notifications DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.sos_contact_notifications
  ADD CONSTRAINT sos_contact_notifications_channel_check
  CHECK (channel IN ('sms', 'email', 'push', 'in_app_message'));
