ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

UPDATE public.profiles
SET role = 'user'
WHERE role IS NULL OR trim(role) = '';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'admin'));

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
