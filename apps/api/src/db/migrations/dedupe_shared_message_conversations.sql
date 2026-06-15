WITH ranked_conversations AS (
  SELECT
    id,
    type,
    context_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY type, context_id
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM public.conversations
  WHERE type IN ('trail', 'meetup')
    AND context_id IS NOT NULL
),
duplicate_conversations AS (
  SELECT id, canonical_id
  FROM ranked_conversations
  WHERE id <> canonical_id
)
INSERT INTO public.conversation_participants (conversation_id, user_id, joined_at, last_read_at)
SELECT
  d.canonical_id,
  cp.user_id,
  MIN(cp.joined_at) AS joined_at,
  MAX(cp.last_read_at) AS last_read_at
FROM duplicate_conversations d
JOIN public.conversation_participants cp
  ON cp.conversation_id = d.id
GROUP BY d.canonical_id, cp.user_id
ON CONFLICT (conversation_id, user_id) DO UPDATE
SET last_read_at = CASE
  WHEN EXCLUDED.last_read_at IS NULL THEN conversation_participants.last_read_at
  WHEN conversation_participants.last_read_at IS NULL THEN EXCLUDED.last_read_at
  ELSE GREATEST(conversation_participants.last_read_at, EXCLUDED.last_read_at)
END;

WITH ranked_conversations AS (
  SELECT
    id,
    type,
    context_id,
    FIRST_VALUE(id) OVER (
      PARTITION BY type, context_id
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM public.conversations
  WHERE type IN ('trail', 'meetup')
    AND context_id IS NOT NULL
)
UPDATE public.messages AS m
SET conversation_id = ranked_conversations.canonical_id
FROM ranked_conversations
WHERE m.conversation_id = ranked_conversations.id
  AND ranked_conversations.id <> ranked_conversations.canonical_id;

WITH message_activity AS (
  SELECT conversation_id, MAX(created_at) AS latest_message_at
  FROM public.messages
  GROUP BY conversation_id
)
UPDATE public.conversations AS c
SET updated_at = GREATEST(c.updated_at, message_activity.latest_message_at)
FROM message_activity
WHERE c.id = message_activity.conversation_id;

WITH ranked_conversations AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY type, context_id
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM public.conversations
  WHERE type IN ('trail', 'meetup')
    AND context_id IS NOT NULL
)
DELETE FROM public.conversations AS c
USING ranked_conversations
WHERE c.id = ranked_conversations.id
  AND ranked_conversations.id <> ranked_conversations.canonical_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_shared_context_unique
ON public.conversations(type, context_id)
WHERE type IN ('trail', 'meetup')
  AND context_id IS NOT NULL;
