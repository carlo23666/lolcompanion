# WP-012 — Item exclusivity in recommendations

## Problem
The engine can recommend two items that cannot (or should not) be carried together —
e.g. Maw of Malmortius + Immortal Shieldbow (both Lifeline), Trinity Force + Essence
Reaper (both Spellblade) — and can recommend an item that conflicts with one the
player already owns. Owner request 2026-07-08.

## Approach (data-derived, no curated table)
Data Dragon item descriptions carry structured `<passive>Name</passive>` markup, and
the in-game "Limited to 1 X item" groups map 1:1 onto shared passive names in the
cached patch (verified on 16.13.1: Salvavidas = Lifeline, Hoja encantada = Spellblade,
Hender = Hydras, Inmolar = Immolate, Heridas graves = antiheal, …). Derive exclusivity
from shared passive names instead of maintaining a curated table, with two guards that
kill the false-positive classes found in the data:

1. **Starter exemption**: items with `depth < 2` never conflict (Doran's items + Tear
   share the "Mano amiga" gold passive but coexist fine).
2. **Component exemption**: items in each other's recursive component tree never
   conflict (Sheen + Trinity, Hexdrinker + Maw, Bramble + Thornmail).

Boots don't share a passive → one extra tag-based group ("Botas") for finished boots.

Even where the shop technically allows both items, recommending two items with the
same non-stacking passive is redundant advice — over-filtering here is a feature.

## Scope
- `src/main/staticdata/itemgraph.ts`: parse passive names into `ItemNode.passives`;
  export `itemConflict(graph, a, b): string | null` (the shared group name, or null).
- `src/main/engine/exclusivity.ts` (new): pure `applyExclusivity(recs, ownedIds,
  staticData)` — drops recommendations conflicting with owned items; among
  conflicting candidates keeps the highest-scored and appends a Spanish reason
  naming the discarded alternative.
- `src/main/engine/recommend.ts`: apply the filter on the final sorted list.
- `src/main/engine/nextbuy.ts`: the core-order walk and the endgame situational pick
  skip items that conflict with an owned item (same pattern as the Magical Footwear
  skip) — otherwise the post-hoc filter would silence the engine instead of letting
  it advance to the next core item.

Out of scope: champ-select suggestions, UI changes, migration of any stored data.

## Acceptance criteria
- [ ] `itemConflict` on the fixture patch: Maw↔Shieldbow = Salvavidas; Trinity↔Essence
      Reaper = Hoja encantada; Hexdrinker↔Sterak's = Salvavidas; finished boots↔boots
      = Botas; Sheen↔Trinity, Bramble↔Thornmail, Oblivion Orb↔Morello = null
      (components); Doran's Ring↔Tear = null (starters); GA↔Zhonya = null.
- [ ] `applyExclusivity`: drops a candidate conflicting with an owned item; among two
      conflicting candidates keeps the higher-scored one and appends a reason naming
      the loser; leaves category-only and non-conflicting recommendations untouched.
- [ ] `nextBuyRecommendation` skips a core item conflicting with an owned item and
      targets the next core item (engine never goes silent because of the filter).
- [ ] `endgameRecommendation` skips a situational conflicting with an owned item.
- [ ] `recommend()` end-to-end: with a fed burst threat and meta forcing Banshee's,
      an owned Edge of Night (shared Anular passive) suppresses the Banshee advice.
- [ ] `npm run check` green; worklog entry written.
