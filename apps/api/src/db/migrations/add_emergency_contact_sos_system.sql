CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  relationship text,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_contacts
  ADD COLUMN IF NOT EXISTS full_name text;

UPDATE public.emergency_contacts
SET full_name = COALESCE(NULLIF(full_name, ''), NULLIF(name, ''), 'Emergency contact')
WHERE full_name IS NULL OR full_name = '';

ALTER TABLE public.emergency_contacts
  ALTER COLUMN full_name SET NOT NULL;

ALTER TABLE public.emergency_contacts
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS relationship text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.emergency_contacts
  ALTER COLUMN phone DROP NOT NULL;

CREATE INDEX IF NOT EXISTS emergency_contacts_user_active_idx
  ON public.emergency_contacts (user_id, is_active);

CREATE INDEX IF NOT EXISTS emergency_contacts_user_primary_idx
  ON public.emergency_contacts (user_id, is_primary)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS emergency_contacts_email_idx
  ON public.emergency_contacts (lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE public.sos_events
  ADD COLUMN IF NOT EXISTS emergency_contacts_notified integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.sos_contact_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_event_id uuid NOT NULL REFERENCES public.sos_events(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.emergency_contacts(id) ON DELETE CASCADE,
  recipient_user_id uuid,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  notification_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sos_event_id, contact_id, channel)
);

ALTER TABLE public.sos_contact_notifications
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'in_app_message',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS notification_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
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

CREATE INDEX IF NOT EXISTS sos_contact_notifications_sos_idx
  ON public.sos_contact_notifications (sos_event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sos_contact_notifications_contact_idx
  ON public.sos_contact_notifications (contact_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS sos_contact_notifications_sos_contact_channel_unique
  ON public.sos_contact_notifications (sos_event_id, contact_id, channel);

DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    ALTER TABLE public.notifications
      DROP CONSTRAINT IF EXISTS notifications_type_check;

    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'follow',
        'review_like',
        'review_comment',
        'activity_like',
        'activity_comment',
        'meetup_invite',
        'meetup_join',
        'meetup_update',
        'sos_alert',
        'emergency_contact_alert',
        'danger_alert',
        'achievement',
        'challenge_created',
        'challenge_invite',
        'challenge_completed',
        'badge_earned',
        'system'
      ));

    ALTER TABLE public.notifications
      DROP CONSTRAINT IF EXISTS notifications_entity_type_check;

    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_entity_type_check
      CHECK (
        entity_type IS NULL OR entity_type IN (
          'achievement',
          'activity',
          'review',
          'trail',
          'user',
          'challenge',
          'badge',
          'sos'
        )
      );
  END IF;
END $$;
