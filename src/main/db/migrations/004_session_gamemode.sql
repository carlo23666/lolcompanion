-- 004: game mode on live sessions. Practice Tool / tutorial games never reach
-- Riot match history, so the post-game report must know the mode to avoid
-- falling back to an older linked match.
ALTER TABLE live_sessions ADD COLUMN gameMode TEXT;
