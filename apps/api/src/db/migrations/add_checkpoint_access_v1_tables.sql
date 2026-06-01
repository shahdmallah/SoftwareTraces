CREATE TABLE IF NOT EXISTS public.checkpoint_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id uuid NOT NULL REFERENCES public.dangerous_locations(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('open', 'slow', 'closed')),
  wait_minutes integer DEFAULT 0 CHECK (wait_minutes >= 0),
  notes text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '2 hours')
);

CREATE TABLE IF NOT EXISTS public.checkpoint_route_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id uuid NOT NULL REFERENCES public.dangerous_locations(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  from_lat numeric NOT NULL,
  from_lng numeric NOT NULL,
  trailhead_lat numeric NOT NULL,
  trailhead_lng numeric NOT NULL,

  waypoint_lat numeric NOT NULL,
  waypoint_lng numeric NOT NULL,
  waypoint_name text,
  notes text,

  original_distance_km numeric,
  original_duration_minutes integer,
  suggested_distance_km numeric,
  suggested_duration_minutes integer,
  extra_distance_km numeric,
  extra_time_minutes integer,

  route_geometry jsonb,

  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'hidden'))
);
