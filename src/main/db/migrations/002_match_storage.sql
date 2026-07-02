-- 002: match history + live session storage (WP-003).
-- raw columns hold the original API payloads; snapshots are gzip-compressed
-- (BLOB) to keep one recorded game well under 20MB.

CREATE TABLE matches (
  matchId TEXT PRIMARY KEY,
  queueId INTEGER NOT NULL,
  patch TEXT NOT NULL,
  gameCreation INTEGER NOT NULL,
  durationS INTEGER NOT NULL,
  win INTEGER, -- owner's result: 1/0, NULL if owner not in match
  raw TEXT NOT NULL
) STRICT;

CREATE INDEX idx_matches_gameCreation ON matches (gameCreation DESC);

CREATE TABLE participants (
  matchId TEXT NOT NULL REFERENCES matches (matchId) ON DELETE CASCADE,
  puuid TEXT NOT NULL,
  champion TEXT NOT NULL,
  role TEXT NOT NULL,
  win INTEGER NOT NULL,
  kills INTEGER NOT NULL,
  deaths INTEGER NOT NULL,
  assists INTEGER NOT NULL,
  cs INTEGER NOT NULL,
  gold INTEGER NOT NULL,
  damage INTEGER NOT NULL,
  vision INTEGER NOT NULL,
  item0 INTEGER NOT NULL DEFAULT 0,
  item1 INTEGER NOT NULL DEFAULT 0,
  item2 INTEGER NOT NULL DEFAULT 0,
  item3 INTEGER NOT NULL DEFAULT 0,
  item4 INTEGER NOT NULL DEFAULT 0,
  item5 INTEGER NOT NULL DEFAULT 0,
  item6 INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (matchId, puuid)
) STRICT;

CREATE INDEX idx_participants_champion ON participants (champion);
CREATE INDEX idx_participants_puuid ON participants (puuid);

CREATE TABLE timelines (
  matchId TEXT PRIMARY KEY REFERENCES matches (matchId) ON DELETE CASCADE,
  raw TEXT NOT NULL
) STRICT;

CREATE TABLE live_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  startedAt TEXT NOT NULL,
  patch TEXT,
  championName TEXT,
  result TEXT, -- NULL until post-game links it (WP-010)
  matchId TEXT REFERENCES matches (matchId)
) STRICT;

CREATE TABLE live_snapshots (
  sessionId INTEGER NOT NULL REFERENCES live_sessions (id) ON DELETE CASCADE,
  gameTimeS REAL NOT NULL,
  raw BLOB NOT NULL, -- gzip(JSON)
  PRIMARY KEY (sessionId, gameTimeS)
) STRICT;
