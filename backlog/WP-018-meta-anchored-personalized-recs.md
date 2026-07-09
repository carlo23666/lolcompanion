# WP-018 — Meta-anchored, role-aware, personalized recommendations

## Why (owner reports, 2026-07-09)
1. A friend played a champion he'd never played; **no item was recommended** (no personal build, and the meta baseline went silent).
2. On **Thresh (support)** he was recommended **Guardian Angel** vs an AD comp — an item no support builds in his history *or* in Master+. Role-inappropriate items must never appear.
3. Owner mandate, restated for the whole app: **Master+ data is the base of every recommendation; the player's own results only tweak it.** e.g. if the common build is A→B→C but the player wins more with A→C→B or A→B→D, adapt to the player's better-performing variant.

## Scope
Engine only (pure). No new dependencies. No migration (reads existing `participants`/`timelines`).

### Part 1 — role-safety + never-silent (fixes 1 & 2)
- The reactive carry-item rules (`armor-vs-mr`, `anti-tank`, `anti-burst`) may only suggest items the champion's **Master+ players actually build** (`metaUsage !== null`). When none of a rule's class options is meta-backed, the rule stays **silent** — no more Guardian Angel / Zhonya / %pen on champions (supports) that never build them. Removes the inverted cap: nothing unbacked ships at all.
  - `antiheal` (grievous wounds — universally appropriate) and `spike-now` (completes items already in the player's inventory) are unchanged.
- `resolveBaseline` never goes silent when data exists: build from meta even below the 20-game trust threshold (thin tier, per-item floor lowered), and fall back to the **player's own build** (Part 2) or the bundled pool before returning null.

### Part 2 — personalize the build with the player's own results (mandate 3)
- New `PersonalItemsInput` (same shape as `MetaItemsInput`) aggregated from the player's stored matches for the played champion: completed-item `{games, wins}` (from `participants.items`) + first-item/order from `timelines`.
- `resolveBaseline` blends it onto the meta base (conservative, sample-gated):
  - **Reorder** the core to the player's own completion order when they have a clear, better-performing order.
  - **Promote/swap** an item the player wins meaningfully more with (games ≥ floor, WR delta over the meta item) into the core.
- Every personalized change carries a reason ("you win more with X — your data: N games, W%"). Master+ stays the base; personal only nudges.
- Threaded through `recommend()` → `liveclient` (new `PersonalBuildRepo` lookup, main-process I/O only).

Champ-select pick suggestions already follow meta-first-then-personal (`champselect.ts`); this brings the in-game **build** in line, closing the INBOX note (2026-07-07).

## Acceptance
- [ ] Thresh UTILITY vs a 5-AD comp never recommends Guardian Angel / Zhonya (no support-illegal item), with or without meta.
- [ ] A champion with thin-but-present Master+ data still gets a build (never empty).
- [ ] A champion with no meta but personal history gets the player's own build.
- [ ] Given a meta build A→B→C and personal data showing the player wins more finishing D (or ordering A→C→B) with enough sample, the recommendation reflects it, with a "your data" reason; below the sample/delta floor it does not move.
- [ ] `npm run check` green; new fixture tests for each bullet; worklog entry.
