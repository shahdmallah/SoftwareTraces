CREATE INDEX IF NOT EXISTS idx_user_follows_follower
  ON user_follows(follower_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_following
  ON user_follows(following_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_composite
  ON user_follows(follower_id, following_id);
