-- 003: persisted recommendations per live session (WP-009), for post-game
-- auditing and the WP-011 backtesting harness.
CREATE TABLE live_recommendations (
  sessionId INTEGER NOT NULL REFERENCES live_sessions (id) ON DELETE CASCADE,
  gameTimeS REAL NOT NULL,
  recommendations TEXT NOT NULL, -- JSON Recommendation[]
  PRIMARY KEY (sessionId, gameTimeS)
) STRICT;
