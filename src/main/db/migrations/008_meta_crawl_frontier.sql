-- 008 (WP-020): resumable crawl frontier. One row per apex seed player with a
-- pagination cursor, so a restart resumes deep paging instead of re-fetching
-- each player's first matches. puuids are opaque ids used ONLY locally for
-- resume — never exported in the seed, never surfaced in the UI (hard rule 2).
CREATE TABLE IF NOT EXISTS meta_crawl_seeds (
  puuid TEXT PRIMARY KEY,
  nextStart INTEGER NOT NULL DEFAULT 0,
  exhausted INTEGER NOT NULL DEFAULT 0,
  updatedAt INTEGER NOT NULL DEFAULT 0
) STRICT;
CREATE INDEX IF NOT EXISTS idx_meta_crawl_seeds_pending
  ON meta_crawl_seeds (exhausted, updatedAt);
