CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_activity_events_user_created_idx
  ON public.user_activity_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_activity_events_type_created_idx
  ON public.user_activity_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS user_activity_events_created_idx
  ON public.user_activity_events (created_at DESC);

CREATE TABLE IF NOT EXISTS public.trail_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL REFERENCES public.trails(id) ON DELETE CASCADE,
  user_id uuid NULL,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trail_view_events_trail_viewed_idx
  ON public.trail_view_events (trail_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS trail_view_events_user_viewed_idx
  ON public.trail_view_events (user_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS trail_view_events_viewed_idx
  ON public.trail_view_events (viewed_at DESC);
