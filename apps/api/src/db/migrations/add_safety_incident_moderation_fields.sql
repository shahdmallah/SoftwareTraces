ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS moderation_status text DEFAULT 'pending';

ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS moderation_note text;

ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS moderated_by uuid NULL;

ALTER TABLE public.safety_incidents
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz NULL;

UPDATE public.safety_incidents
SET moderation_status = 'pending'
WHERE moderation_status IS NULL OR trim(moderation_status) = '';

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT COUNT(*)::int
  INTO invalid_count
  FROM public.safety_incidents
  WHERE moderation_status NOT IN ('pending', 'approved', 'rejected', 'hidden', 'active', 'resolved', 'expired');

  IF invalid_count = 0 THEN
    ALTER TABLE public.safety_incidents
      DROP CONSTRAINT IF EXISTS safety_incidents_moderation_status_check;

    ALTER TABLE public.safety_incidents
      ADD CONSTRAINT safety_incidents_moderation_status_check
      CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'hidden', 'active', 'resolved', 'expired'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS safety_incidents_moderation_status_idx
  ON public.safety_incidents(COALESCE(moderation_status, 'pending'));
