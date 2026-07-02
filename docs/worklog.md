# Worklog
Builder sessions append entries here (date, WP, summary, deviations, gaps, files touched). Newest first.

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
