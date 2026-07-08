-- 006: item completion ORDER from match timelines (WP-015). Frequency alone
-- made popular-but-late items look like first buys; these aggregates record
-- WHEN Master+ players finish each item.

ALTER TABLE meta_matches ADD COLUMN hasTimeline INTEGER NOT NULL DEFAULT 0;

CREATE TABLE meta_champion_item_order (
  patch TEXT NOT NULL,
  champion TEXT NOT NULL,
  role TEXT NOT NULL,
  itemId INTEGER NOT NULL,
  -- Games where this champion+role completed the item.
  games INTEGER NOT NULL DEFAULT 0,
  -- Sum of 1-based completion positions (games * avgSlot).
  slotSum INTEGER NOT NULL DEFAULT 0,
  -- Games where it was the FIRST finished item.
  firstGames INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (patch, champion, role, itemId)
) STRICT;
