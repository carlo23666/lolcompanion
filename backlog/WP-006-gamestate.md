# WP-006 — GameState normalizer + diff engine

## Objective
Single normalized model the engine consumes, plus semantic diffs between snapshots.

## Scope
- `src/shared/gamestate.ts`: GameState = { gameTimeS, patch, self (champ, level, gold, stats, items[], runes), allies[5], enemies[5] (champ, level, items[], scores, dead/respawn), objectives (dragons taken by type, baron/herald events, towers), teamAggregates }.
- Normalizer `src/main/engine/normalize.ts`: (allgamedata snapshot, StaticData) → GameState. Resolves item IDs to full item objects, computes derived team aggregates: physical/magic damage split estimate (champion damage profile + items), estimated enemy tankiness (base+growth+visible items), healing/shielding index, estimated gold per enemy (CS + kills + assists + passive income model — document the formula).
- Diff engine: (prev, next) → events: itemCompleted(player, item), levelUp, objectiveTaken, playerDied/respawned. Deterministic, tested.
- Feed live snapshots through normalizer; renderer placeholder shows the computed aggregates live.

## Acceptance criteria
- [ ] Normalizer tested against ≥3 fixture snapshots (early/mid/late) with hand-verified expected aggregates committed as test expectations.
- [ ] Gold estimation within ±15% of real values when replayed against a match timeline from WP-004 (write this comparison test — pick 2 matches, compare estimate at min 10/20 vs timeline gold).
- [ ] Diff engine: replay a full recorded session, assert item-completion events match reality (spot-check 5 known purchases).

## Out of scope
Recommendations. UI beyond debug view.

## Review checklist
Pure functions, no I/O; gold model documented in code; aggregates unit-tested with real fixtures, not synthetic.
