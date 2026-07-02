# Worklog
Builder sessions append entries here (date, WP, summary, deviations, gaps, files touched). Newest first.

## 2026-07-02 — WP-004 — Riot API client + rate limiter + history ingestion
**Done:** `src/main/riot/` — `RiotRateLimiter` (token buckets for app limits 20/1s + 100/120s AND per-method limits, fixed windows; priority queue with no head-of-line blocking across methods; `Retry-After` honored on 429 with replay through the queue so retries consume fresh tokens; 403 → persistent `RiotKeyInvalidError`, everything fails fast until `reset()`, no retry storm). Typed `RiotClient` (account-v1 by-riot-id, match-v5 ids/match/timeline, league-v4 entries by-puuid) with platform→regional routing map, zod validation of every payload (`src/shared/schemas/riot.ts`), `Result`-style returns, API key only in the `X-Riot-Token` header and never in error messages. Resumable `ingestHistory` walking matchlist newest→oldest, skipping stored ids (resume = skip, no re-download), owner-centric `matches.win`, progress via `ingest:progress` IPC. Settings (riotId/platform/puuid cache) in the meta table; `ingest:start`/`settings:get`/`settings:set` IPC; renderer settings stub with sync button + progress bar. Zero-dep `.env` loader (`src/main/env.ts`). 18 new tests (limiter with fake timers incl. burst/120s window/429 replay/method independence/priority/403; client against fixtures; ingestion store/resume/fail/cancel/maxMatches).

**Deviations:**
- Match + timeline fixtures are **synthetic but shape-accurate** (anonymized PLAYER_1..10): no API key available in this session to record real ones. Owner: after configuring `.env`, run one sync and consider re-recording fixtures from a real response (INBOX).
- Per-method limits use conservative defaults (200/10s for match-v5) rather than parsing `X-Method-Rate-Limit` response headers dynamically; noted in INBOX as an improvement.
- `maxMatches` for the UI sync is set to 200 per the acceptance criterion ("last 200 matches").
- Renamed `src/main/env.d.ts` → `src/main/modules.d.ts` (new `env.ts` shadowed the declaration file with the same basename).

**Gaps (owner):** real 200-match sync (needs `.env` key), invalid-key UI path visually confirmed (logic tested).

**Files:** src/main/riot/{limiter,client,ingest,index}.ts, src/shared/schemas/riot.ts, src/main/env.ts, src/main/modules.d.ts, src/main/db/repos/settings.ts, src/shared/ipc.ts, src/preload/index.ts, src/main/index.ts, src/renderer/src/{SettingsStub.tsx,App.tsx}, fixtures/riot/{match,timeline}.json, tests/main/riot-*.test.ts.

## 2026-07-02 — WP-003 — SQLite store + schema
**Done:** migration 002 creating `matches`, `participants` (items0-6 + kda/cs/gold/damage/vision aggregates), `timelines`, `live_sessions`, `live_snapshots`, with indices on participants.champion, participants.puuid, matches.gameCreation, all STRICT tables with FK cascade. Repo layer `src/main/db/repos/` (`MatchRepo`, `TimelineRepo`, `LiveSessionRepo`) — idempotent inserts via INSERT OR IGNORE inside transactions, no SQL outside repos. Live Client wired to persist every validated snapshot into live_sessions/live_snapshots (`LiveSessionPersister`: new session on game-time reset, session closed when port drops; file recorder unchanged for fixtures). 10 new tests: round-trips for every table, idempotency, champion/recency queries, session lifecycle, and a 900-snapshot size check.

**Deviations:**
- **Snapshots stored gzip-compressed (BLOB)**: 900 × ~30KB raw JSON ≈ 27MB > the 20MB acceptance budget; gzip is lossless and brings a padded 900-snapshot game to well under 20MB (verified by test). Transparent in the repo API.
- `live_sessions.championName` stores the champion display name (string) rather than a numeric id — that's what the Live Client exposes; `patch` stays NULL until WP-010 links the real match.
- Raw JSON columns are re-validated on read as JSON objects only; full match-v5 zod validation happens at ingestion (WP-004) — reads shouldn't re-run 1000-line schemas on every query. Flagging for review vs the checklist wording.
- Matches fixture in repo tests is synthetic-but-realistic; the real recorded match-v5 fixture lands with WP-004 as specced.

**Files:** src/main/db/migrations/002_match_storage.sql, src/main/db/migrations/index.ts, src/main/db/repos/{matches,liveSessions,index}.ts, src/main/liveclient/{persist,index}.ts, src/main/index.ts, tests/main/{repos,live-persist}.test.ts.

## 2026-07-02 — WP-002 — Static data manager (Data Dragon)
**Done:** `src/main/staticdata/` — `StaticDataManager` downloading item/champion/runesReforged (es_ES) for the latest patch into `<userData>/staticdata/<patch>/`, serving from cache when offline (newest cached patch) and never re-downloading a cached patch; zod schemas in `src/shared/schemas/ddragon.ts`; item graph (buildsFrom/buildsInto, total & recipe gold, purchasable, SR-only filter, component tree + upgrade-chain helpers); gold-efficiency helper with documented per-stat gold values (derived from basic items); champion stat-at-level using Riot's non-linear growth formula (`(n-1)*(0.7025+0.0175*(n-1))`, AS as % of base); hand-curated `champion-damage-profile.json` covering all 173 champions of patch 16.13.1. Lookup maps by ddragon id, display name and numeric key. Real fixture files committed under `fixtures/ddragon/16.13.1/`. 26 new tests (schemas, IE component/gold math, boots chain, stat-at-level vs hand-computed values, efficiency %, cache behavior with mocked fetch, profile completeness).

**Deviations / judgment calls:**
- Damage profile for champions released after my knowledge (Locke, Yunara, Zaahen) is a best-effort guess (physical/physical/mixed) — **owner should verify these three**. The completeness test will also fail loudly whenever a new patch adds a champion, which is the desired behavior.
- Gold-per-stat table is constants (matching current basic items) rather than recomputed per patch; documented in `goldefficiency.ts`. Fine while basic item ratios stay stable — revisit if Riot rebalances basics.
- Per-champion detail files (`champion/<Name>.json`) deferred until something needs spell data; base `champion.json` covers all WP-006/007 needs. Noted in INBOX.

**Files:** src/main/staticdata/{manager,itemgraph,champstats,goldefficiency,index}.ts, src/main/staticdata/champion-damage-profile.json, src/shared/schemas/ddragon.ts, fixtures/ddragon/16.13.1/*, tests/main/{staticdata-*,itemgraph,champstats,goldefficiency}.test.ts.

## 2026-07-02 — WP-001 — Live Client connector + payload recorder
**Done:** `src/main/liveclient/` — poller with `unavailable → polling` states, 2s cadence in game, exponential backoff 2→4→8→10s cap when port closed, never crashes with LoL closed; https transport with `certs/riotgames.pem` pinned as the ONLY trusted CA (downloaded from Riot's official docs; bundled via electron-builder `extraResources`); zod schema `src/shared/schemas/liveclient.ts` (loose objects: required fields validated, unknown tolerated); recorder (`RECORD_LIVE=1`, dev-only, refuses to run packaged) dumping raw snapshots to `fixtures/recordings/<timestamp>/<gametime>.json` with new-dir-on-game-reset; anonymizer `npm run fixtures:anonymize` (PLAYER_1..N consistent per session, also covers KillerName/VictimName/Assisters in the event feed, taglines → TAG); IPC `live:snapshot` + `live:state` push channels with typed `window.api.on` and preload allowlist; renderer placeholder shows game clock + player list. Official sample payload committed to `fixtures/`. 14 new tests (schema incl. malformed/passthrough cases, poller with fake timers, recorder, renderer).

**Deviations:**
- **Transport uses `node:https`, not global fetch:** Node's fetch cannot pin a per-request CA without adding the `undici` dependency; node:https is stdlib and gives explicit `ca:` control. TLS verification is never disabled.
- **Hostname check skipped for the loopback connection only:** the game's cert doesn't carry `127.0.0.1` as SAN, so `checkServerIdentity` is a no-op for this single, hard-coded `127.0.0.1:2999` request while the chain-of-trust against the pinned Riot CA remains fully enforced. This is the standard approach for this API; flagging for review.
- Poller validation failure (reachable but malformed) stays in `polling` cadence and reports via `onValidationError` instead of backing off — a live game is running, so backing off would just delay recovery.

**Gaps (owner actions pending):** record ≥1 real game (`RECORD_LIVE=1 npm run dev`, then `npm run fixtures:anonymize`, commit early/mid/late snapshots); confirm real payload parses with zero zod errors. The riotgames.pem→game-cert chain could not be verified against a live client from this session.

**Files:** src/main/liveclient/{index,poller,recorder,transport}.ts, src/shared/schemas/liveclient.ts, src/shared/ipc.ts, src/main/ipc.ts (broadcast), src/main/index.ts, src/preload/index.ts, src/renderer/src/App.tsx, scripts/anonymize-fixtures.mjs, electron-builder.yml, certs/riotgames.pem, fixtures/liveclientdata_sample.json, tests/main/liveclient-*.test.ts, tests/renderer/{app.test.tsx,setup.ts}, eslint.config.js, package.json.

## 2026-07-02 — WP-000 — Repo bootstrap
**Done:** electron-vite scaffold (main/preload/renderer, TS strict + noUncheckedIndexedAccess), React 18 + Tailwind 4, typed IPC (`src/shared/ipc.ts`, `app:ping` demo with preload allowlist, contextIsolation on / nodeIntegration off), better-sqlite3 with idempotent migration runner (`schema_migrations` tracking, migration 001 `meta` table, SQL imported as `?raw` so the main bundle is self-contained), vitest (node + jsdom projects) + eslint 10 flat config (typescript-eslint typeChecked) + prettier, scripts `dev/build/test/check`, `.env.example`, `certs/README.md` placeholder, GitHub Actions running `npm run check`.

**Deviations:**
- **Native-module ABI strategy:** Electron 43 bundles Node 24.17; system Node is 25.x, so one better-sqlite3 build cannot serve both. Decision: `postinstall` runs `electron-builder install-app-deps` (compiles for Electron ABI) and `npm test` runs vitest through Electron's own Node (`ELECTRON_RUN_AS_NODE=1 electron node_modules/vitest/vitest.mjs run`). Single ABI everywhere; verified working. Note: the test script uses POSIX env syntax (owner is on macOS, CI on ubuntu).
- Vite pinned to ^7 and @vitejs/plugin-react to ^5: electron-vite 5.0 does not support vite 8 yet.
- TypeScript 6 deprecates `baseUrl`; path aliases declared relative to tsconfig instead.
- React kept at 18 per CLAUDE.md (19 is npm latest).

**Gaps:** `npm run dev` smoke-tested headlessly (dev server + electron start clean, no errors); visual confirmation of the ping reply in the window pending owner — covered meanwhile by renderer component test with mocked `window.api`. CI not yet observed green (no remote yet).

**Machine note (not repo):** owner's `~/.npm` cache has root-owned files; installs used an alternate cache. Fix with `sudo chown -R 501:20 ~/.npm`.

**Files:** package.json, tsconfig*.json, electron.vite.config.ts, vitest.config.ts, eslint.config.js, .prettierrc.json, src/main/{index,ipc}.ts, src/main/db/{index.ts,migrations/}, src/preload/index.ts, src/renderer/**, src/shared/ipc.ts, tests/**, .github/workflows/check.yml, .env.example, certs/README.md, .gitignore.
