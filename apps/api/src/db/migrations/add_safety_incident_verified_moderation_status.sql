ALTER TABLE public.safety_incidents
  ALTER COLUMN moderation_status SET DEFAULT 'pending';

UPDATE public.safety_incidents
SET moderation_status = 'approved'
WHERE source = 'ocha'
  AND moderation_status = 'active';

DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT COUNT(*)::int
  INTO invalid_count
  FROM public.safety_incidents
  WHERE moderation_status NOT IN ('pending', 'approved', 'verified', 'rejected', 'hidden', 'active', 'resolved', 'expired');

  IF invalid_count = 0 THEN
    ALTER TABLE public.safety_incidents
      DROP CONSTRAINT IF EXISTS safety_incidents_moderation_status_check;

    ALTER TABLE public.safety_incidents
      ADD CONSTRAINT safety_incidents_moderation_status_check
      CHECK (moderation_status IN ('pending', 'approved', 'verified', 'rejected', 'hidden', 'active', 'resolved', 'expired'));
  END IF;
END $$;
