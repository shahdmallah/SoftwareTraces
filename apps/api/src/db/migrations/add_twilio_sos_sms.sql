CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.emergency_contacts
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS full_name text;

UPDATE public.emergency_contacts
SET full_name = COALESCE(NULLIF(full_name, ''), NULLIF(name, ''), 'Emergency contact')
WHERE full_name IS NULL OR full_name = '';

ALTER TABLE public.sos_events
  ADD COLUMN IF NOT EXISTS emergency_contacts_notified integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.sos_contact_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_event_id uuid NOT NULL REFERENCES public.sos_events(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.emergency_contacts(id) ON DELETE CASCADE,
  user_id uuid,
  channel text NOT NULL,
  provider text,
  recipient_phone text,
  recipient_email text,
  status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sos_event_id, contact_id, channel)
);

ALTER TABLE public.sos_contact_notifications
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.sos_contact_notifications
  DROP CONSTRAINT IF EXISTS sos_contact_notifications_channel_check;

ALTER TABLE public.sos_contact_notifications
  ADD CONSTRAINT sos_contact_notifications_channel_check
  CHECK (channel IN ('sms', 'email', 'push', 'in_app_message'));

ALTER TABLE public.sos_contact_notifications
  DROP CONSTRAINT IF EXISTS sos_contact_notifications_status_check;

ALTER TABLE public.sos_contact_notifications
  ADD CONSTRAINT sos_contact_notifications_status_check
  CHECK (status IN ('queued', 'sent', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS sos_contact_notifications_user_created_idx
  ON public.sos_contact_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sos_contact_notifications_provider_status_idx
  ON public.sos_contact_notifications (provider, status, created_at DESC);
