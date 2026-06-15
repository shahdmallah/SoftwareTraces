ALTER TABLE public.achievements
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE public.achievements
SET is_active = true
WHERE is_active IS NULL;
