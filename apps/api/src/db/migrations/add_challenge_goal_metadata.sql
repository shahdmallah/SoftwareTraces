ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS goal_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
