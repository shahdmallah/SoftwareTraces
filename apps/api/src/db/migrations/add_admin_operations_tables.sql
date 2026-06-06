CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS name_ar text;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS description_ar text;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS badge_icon_url text;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS criteria_type text NOT NULL DEFAULT 'manual';
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS criteria_value jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.achievements
SET badge_icon_url = COALESCE(badge_icon_url, icon)
WHERE badge_icon_url IS NULL;

ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS progress_current numeric NOT NULL DEFAULT 0;
ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS progress_target numeric NOT NULL DEFAULT 0;
ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS earned_at timestamptz;
ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_achievements ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.user_achievements
SET earned_at = COALESCE(earned_at, unlocked_at)
WHERE earned_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_achievements_id_unique ON public.user_achievements(id);

CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN (
    'complete_trails',
    'total_distance_km',
    'complete_difficulty',
    'join_meetups',
    'submit_safety_reports',
    'checkpoint_reports'
  )),
  goal_value numeric NOT NULL CHECK (goal_value > 0),
  goal_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reward_badge_id uuid REFERENCES public.achievements(id) ON DELETE SET NULL,
  reward_points integer NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS challenges_status_visibility_idx ON public.challenges(status, visibility);
CREATE INDEX IF NOT EXISTS challenges_dates_idx ON public.challenges(start_at, end_at);
CREATE INDEX IF NOT EXISTS challenges_reward_badge_idx ON public.challenges(reward_badge_id) WHERE reward_badge_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  progress_value numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'completed', 'failed')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS challenge_participants_user_idx ON public.challenge_participants(user_id, status);
CREATE INDEX IF NOT EXISTS challenge_participants_challenge_idx ON public.challenge_participants(challenge_id, status);
