-- 005: aggregated Master+ meta statistics, crawled from the Riot API by the
-- owner's own key (the op.gg approach at personal scale). Only aggregates are
-- stored — never player identities, never full match payloads.

-- Dedupe/resume ledger: every fetched match id lands here exactly once.
CREATE TABLE meta_matches (
  matchId TEXT PRIMARY KEY,
  patch TEXT NOT NULL
) STRICT;

CREATE INDEX idx_meta_matches_patch ON meta_matches (patch);

CREATE TABLE meta_champion_stats (
  patch TEXT NOT NULL,
  champion TEXT NOT NULL, -- ddragon id (match-v5 championName)
  role TEXT NOT NULL, -- teamPosition: TOP|JUNGLE|MIDDLE|BOTTOM|UTILITY|''
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (patch, champion, role)
) STRICT;

-- Lane matchups: champion vs the same-position enemy.
CREATE TABLE meta_matchups (
  patch TEXT NOT NULL,
  champion TEXT NOT NULL,
  role TEXT NOT NULL,
  enemyChampion TEXT NOT NULL,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (patch, champion, role, enemyChampion)
) STRICT;

-- Final-build item frequencies (from participant item0-5 at game end).
CREATE TABLE meta_champion_items (
  patch TEXT NOT NULL,
  champion TEXT NOT NULL,
  role TEXT NOT NULL,
  itemId INTEGER NOT NULL,
  games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (patch, champion, role, itemId)
) STRICT;
