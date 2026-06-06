DO $$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_entity_type_check;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_entity_type_check
    CHECK (
      entity_type IS NULL
      OR entity_type IN (
        'user',
        'trail',
        'review',
        'activity',
        'meetup',
        'achievement',
        'challenge'
      )
    );

  ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (
      type IN (
        'follow',
        'review_like',
        'review_comment',
        'activity_like',
        'activity_comment',
        'meetup_invite',
        'meetup_join',
        'meetup_update',
        'sos_alert',
        'danger_alert',
        'achievement',
        'challenge_created',
        'challenge_invite',
        'challenge_completed',
        'badge_earned',
        'system'
      )
    );
END $$;
