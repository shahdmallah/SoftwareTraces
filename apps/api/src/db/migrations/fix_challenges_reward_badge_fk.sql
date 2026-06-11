ALTER TABLE public.challenges
DROP CONSTRAINT IF EXISTS challenges_reward_badge_id_fkey;

UPDATE public.challenges AS c
SET reward_badge_id = NULL
WHERE c.reward_badge_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.achievements AS a
    WHERE a.id = c.reward_badge_id
  );

ALTER TABLE public.challenges
ADD CONSTRAINT challenges_reward_badge_id_fkey
FOREIGN KEY (reward_badge_id)
REFERENCES public.achievements(id)
ON DELETE SET NULL;
