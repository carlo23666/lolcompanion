# Architecture (condensed — v1, 2026-07-02)

## Data sources
1. **Live Client Data API** — `https://127.0.0.1:2999/liveclientdata/allgamedata`. Own live game, all 10 players (champ, items, level, scores, spells, death state), active player full stats + gold + runes, event feed (kills, towers, dragons w/ type, herald, baron), game clock. Local only, no key, no rate limit. Self-signed cert → pin `certs/riotgames.pem`. Poll 2s. Does NOT expose enemy cooldowns/positions/gold (estimate gold from CS/kills/time).
2. **LCU API** — local client REST+WS, credentials from lockfile (`league-connect`). Used for: gameflow phase, champ select session (champion IDs only; identities are anonymized in ranked and must never be surfaced), later rune import. Unofficial, may break per client patch → isolated module, graceful degradation.
3. **Riot Web API** — personal key (free). account-v1, match-v5 (+timeline), league-v4. App limits ~20/1s & 100/120s per region + per-method limits → token-bucket limiter mandatory. PUUID-based only.
4. **Data Dragon** — static per-patch data: items (graph, gold), champions (base+growth), runes. Cached locally per patch. CommunityDragon as gap-filler only.

## Policy hard limits (from Riot, 2025)
No enemy cooldown/ult tracking; no de-anonymization (champ select ranked, Streamer Mode); no memory reading (Vanguard); no .rofl reversing; recommendations must derive from on-screen-visible info. Spectator-V5 is dead — live data of arbitrary players is not available and not needed.

## Process split
- **Main process**: all I/O — LCU connector, :2999 poller, Riot API client+limiter, Data Dragon cache, SQLite (better-sqlite3), session state machine (`idle→clientOpen→champSelect→inGame→postGame`), rules engine.
- **Renderer**: React + Tailwind, pure presentation over typed IPC (`src/shared/ipc.ts`).
- All external payloads validated with zod (`src/shared/schemas/`); recorded real payloads (anonymized) as test fixtures.

## Engine
`(GameState, StaticData) → Recommendation[]`, pure & sync.
- **GameState** (`src/shared/gamestate.ts`): normalized snapshot + derived team aggregates (damage split, tankiness, healing index, estimated enemy gold).
- **Layer A**: curated baseline builds per owner champion/role (`baselines/pool.json`).
- **Layer B**: deterministic rules adjusting the baseline (antiheal, armor-vs-MR, anti-tank, anti-burst, gold-aware spike timing). Every Recommendation carries `reasons: string[]` — explainability is the product.
- Validation: backtesting harness replaying own match timelines through the engine (agreement metrics, threshold tuning).
- ML deferred to phase 3; LLM only as optional natural-language narration layer, never decision-maker.

## Persistence (SQLite, userData dir)
`matches`, `participants`, `timelines`, `live_sessions`, `live_snapshots` + static caches. Repos layer, migrations numbered.

## Phases
P0 exploration (recordings) → P1 MVP panel (WP-000..011) → P2 overlay + champ select recs + rune import → P3 high-elo mining (GitHub Actions), personal analytics, optional backend (Cloudflare free tier) only if distributed.
