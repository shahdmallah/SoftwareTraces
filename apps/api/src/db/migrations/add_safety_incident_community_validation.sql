ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS confirmations_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS disputes_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS community_confidence_score numeric NOT NULL DEFAULT 0;

UPDATE public.safety_incidents
SET confirmations_count = GREATEST(confirmations_count, COALESCE(confirmed_count, 0))
WHERE confirmations_count < COALESCE(confirmed_count, 0);

CREATE TABLE IF NOT EXISTS public.safety_incident_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.safety_incidents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  feedback_type text NOT NULL CHECK (feedback_type IN ('confirm', 'dispute', 'note')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id, user_id),
  UNIQUE (incident_id, user_id, feedback_type)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'safety_incident_feedback_incident_user_type_unique'
      AND conrelid = 'public.safety_incident_feedback'::regclass
  ) THEN
    ALTER TABLE public.safety_incident_feedback
      ADD CONSTRAINT safety_incident_feedback_incident_user_type_unique
      UNIQUE (incident_id, user_id, feedback_type);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS safety_incident_feedback_incident_idx
  ON public.safety_incident_feedback(incident_id, feedback_type);

CREATE INDEX IF NOT EXISTS safety_incident_feedback_user_idx
  ON public.safety_incident_feedback(user_id, created_at DESC);
