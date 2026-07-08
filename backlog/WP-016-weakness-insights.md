# WP-016 — Weakness insights from personal history

## Problem (owner request 2026-07-08)
The stats page shows numbers but doesn't SAY anything: the app should aggregate the
stored history into explicit weak points — "you die too much in lane", "you barely
ward", "you get ganked constantly", "objectives fall while you're dead", "you're out
of your team's plays" — so the player knows what to fix. Also wanted as a site
selling point.

## Approach
Pure detector over prepared per-game inputs (`computeWeaknesses`), service builds the
inputs from stored matches + timelines (defensive reads, WP-003 policy), result rides
the existing `stats:overview` payload, and StatsView renders a "Puntos débiles" panel.

Detectors (thresholds documented in code, same style as engine THRESHOLDS):
1. **deaths-by-phase** — avg deaths in early (<14 min) / mid (14-25) / late (>25,
   only games that reached it); flagged when a phase exceeds its threshold.
2. **gankable** — early deaths with the enemy JUNGLER as killer/assist, per game
   (timeline CHAMPION_KILL events).
3. **low-vision** — vision/min vs a role-aware benchmark (support ≫ jungle > rest).
4. **objectives-while-dead** — share of enemy ELITE_MONSTER_KILLs within 45 s of an
   own death.
5. **low-kill-participation** — (K+A)/team kills below role-aware floor.

Each insight: key, severity (medium/high), Spanish finding with the numbers baked in,
one actionable advice line, sample size. Minimum samples gate everything (≥8 games;
timeline detectors ≥5 games with timelines) — no noise on fresh installs.

## Scope
- `src/shared/stats.ts`: `WeaknessInsight`, `StatsOverview.weaknesses`.
- `src/main/stats-weaknesses.ts` (new): pure `computeWeaknesses` + pure timeline
  extractor `extractWeaknessEvents`.
- `src/main/stats.ts`: build inputs, wire into `overview()`.
- `src/renderer/src/components/StatsView.tsx`: "Puntos débiles" panel.
- Site copy (WP-013 page) explains the feature.

## Acceptance criteria
- [ ] Each detector fires on crafted inputs and stays silent under the sample gates
      and below thresholds (pure-fn tests).
- [ ] Timeline extractor: own deaths with enemy-jungler involvement + enemy elite
      kills, from a synthetic timeline (fixture test).
- [ ] `stats:overview` carries `weaknesses`; StatsView renders them (component test).
- [ ] `npm run check` green; worklog entry.
