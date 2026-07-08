# WP-015 — Build-order intelligence (the "Bramble first on Nasus" bug)

## Problem (owner report 2026-07-08, friend's real game)
A friend playing Nasus vs a full-AD comp was told to buy Bramble Vest as his FIRST item.
No Master+ player opens with Bramble. Root causes, confirmed in code:

1. **Frequency order ≠ build order.** `meta_champion_items` stores final-build frequency;
   `resolveBaseline` uses "most-bought" as the core ORDER. A popular-but-late item
   (Thornmail) can rank early → `nextBuyRecommendation`'s partial-buy logic then advises
   its most expensive affordable component → literally "Bramble Vest, first buy".
2. **Components pass the baseline filter.** The `usable` filter accepts any depth≥2
   SR item — Bramble/Sheen/Hexdrinker themselves can enter core/situational when they
   appear in final builds.
3. **Reactive rules are phase-blind.** armor-vs-mr vs a 100% AD comp scores
   `40 + 0.38×150 = 97` at minute 0 — outranking the actual build path with "COMPRA YA"
   before the first back.

## Approach — recover the missing information (owner: "if it needs more info, fine")
Match-v5 **timelines** record every ITEM_PURCHASED with timestamp. The Riot client
already exposes `timeline()`. Aggregate per champion+role the ORDER in which finished
items are completed; the engine then builds cores in real Master+ order.

### A. Data (crawler + storage + seed)
- Migration 006: `meta_matches.hasTimeline` flag + table `meta_champion_item_order
  (patch, champion, role, itemId, games, slotSum, firstGames)` — slotSum accumulates
  1-based completion positions, firstGames counts "was the first finished item".
- Pure `aggregateTimelineOrder(match, timeline, isOrderable)` in `meta-aggregate.ts`:
  first purchase occurrence per orderable item per participant, in event order
  (ITEM_UNDO/ITEM_SOLD deliberately ignored — noise-level for finished items).
- Crawler: after each aggregated match, fetch its timeline (one extra API call — halves
  throughput to ~1k matches/h, accepted) and fold order deltas. **Backfill**: at run
  start, walk `meta_matches` rows with `hasTimeline = 0` (skipping 'skip' rows),
  re-fetch match + timeline, aggregate order only. The existing 13.8k matches upgrade
  over a few background runs.
- Seed schema v2 (v1 still imports): optional `itemOrder` rows; export includes them.

### B. Engine (works with or without order data)
- `MetaItemStat` gains optional `orderGames/slotSum/firstGames`; the liveclient +
  champselect lookups join them in.
- `resolveBaseline`: exclude components from `usable` (`buildsInto.length === 0`, with
  a finished-boots exception); when ≥3 usable items carry order data (orderGames ≥ 3),
  sort core by average completion slot instead of frequency. Fallback: today's order.
- armor-vs-mr: while self owns no completed item, cap at SUGGESTION_SCORE_CAP with an
  explicit "tu primer objeto sigue siendo la prioridad" reason — planning info, never
  the top pick pre-first-back.

## Acceptance criteria
- [ ] Timeline aggregation: first-occurrence dedupe, event order, non-orderable items
      ignored, participant→champion/role mapping correct (fixture test).
- [ ] Migration 006 applies; order deltas idempotent per match; `orderStatsFor` and
      `matchesNeedingTimeline` behave (repo tests).
- [ ] Crawler folds order aggregates for new matches AND backfills old ones; timeline
      fetch failure leaves `hasTimeline = 0` and does not lose the match aggregate.
- [ ] `resolveBaseline` with order data: core sorted by avg slot; Bramble/Sheen never
      in core; without order data behavior unchanged (fixture tests).
- [ ] armor-vs-mr capped ≤ SUGGESTION_SCORE_CAP with zero completed items; uncapped
      once a completed item exists.
- [ ] Regression: Nasus-like scenario (tank, full-AD enemies, minute 3, no items) never
      yields a component or a reactive armor item as the TOP recommendation.
- [ ] Seed v2 exports/imports order rows; v1 seeds still import.
- [ ] `npm run check` green; worklog entry.
