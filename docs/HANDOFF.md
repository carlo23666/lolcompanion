# HANDOFF — resume point after phase 1 build (2026-07-02)

Read this first when resuming work in a new Claude Code session. Then:
`CLAUDE.md` (rules) → `docs/worklog.md` (what happened, per WP) → `backlog/INBOX.md` (discovered work).

## Where the project stands

All 12 phase-1 work packages (WP-000 → WP-011) are **built and committed**, one commit per WP,
`npm run check` green (185 tests / 28 files, typecheck + lint + vitest). Statuses in
`backlog/README.md` are **BUILT (pending review)** — the reviewer loop in `docs/review-process.md`
has NOT run yet. Built entirely on macOS; never yet run against a real League client.

### What the app can do right now

- **Session tracking**: detects `idle → clientOpen → champSelect → inGame → postGame` by combining
  the LCU websocket (league-connect) with port-2999 availability. Survives client kills/restarts.
- **Live game**: polls the Live Client Data API every 2s (pinned Riot cert, exponential backoff),
  validates with zod, persists gzip'd snapshots to SQLite, optionally records raw fixtures to disk
  (Ajustes toggle or `RECORD_LIVE=1`; anonymize with `npm run fixtures:anonymize`).
- **GameState + engine**: normalizes snapshots into a single GameState (item graph resolution,
  documented gold/damage-split/tankiness/healing estimators), computes semantic diffs, and runs a
  pure sync engine: 5 rules (antiheal, armor-vs-mr, anti-tank, anti-burst, spike-now) + baseline
  next-buy from `src/main/engine/baselines/pool.json`, merged and ranked, every recommendation
  with Spanish reasons. <50ms per pass (tested).
- **UI** (dark, Spanish): sidebar Live/Historial/Ajustes. Live panel: phase banner, both teams with
  items/KDA/death timers, enemy damage-split + tankiness gauges, objectives row, recommendation
  card with in-game audit history. Designed empty states for every phase. Icons via local
  `ddicon://` cache (lazy per-icon download, then offline).
- **Match history**: manual sync of last 200 matches (rate-limited: 20/1s + 100/120s + per-method,
  Retry-After honored, resumable) + automatic post-game ingestion with retry (30s→120s schedule)
  linking the finished match to the live session. Historial view: filterable list, winrate/CS-min
  aggregate chips, detail drawer with final build + gold sparkline. Works offline once stored.
- **Backtesting**: `npm run backtest -- --champion X --last 50` reconstructs GameStates from stored
  timelines (exact gold, items from purchase events), replays the engine, reports top-1/top-3
  agreement by champion/phase + worst disagreements, dumps JSON to `reports/`.

### Verified vs pending verification

Everything above is covered by tests against fixtures. **But most fixtures are synthetic**
(shape-accurate, built from the real Data Dragon patch): the app has never seen a real running
game, a real champ select, or a real Riot API response. That's the main purpose of the Windows move.

## First session on Windows — do this in order

1. **Clone + install**: `git clone https://github.com/carlo23666/lolcompanion.git`, `npm install`
   (postinstall rebuilds better-sqlite3 for the Electron ABI automatically).
2. **Fix Windows incompatibilities** (small, known, blocking `npm run check`):
   - `package.json` `test` script uses POSIX env syntax
     (`ELECTRON_RUN_AS_NODE=1 electron …`) — breaks on cmd/PowerShell. Add `cross-env`
     (devDependency, note it in the worklog) or convert to a small Node launcher script.
   - `src/main/backtest/cli.ts` `defaultUserData()` hardcodes the macOS path
     (`~/Library/Application Support/lol-companion`). Add the Windows equivalent
     (`%APPDATA%/lol-companion`) — keep it dependency-free.
   - `scripts/backtest.mjs` uses `spawnSync('npx', …)` which on Windows needs
     `shell: true` (or resolve `npx.cmd`).
   - Run `npm run check` until green; commit as a `fix:` WP-agnostic commit with worklog note.
3. **Configure**: copy `.env.example` → `.env`, add `RIOT_API_KEY`
   (https://developer.riotgames.com, personal key). In Ajustes: Riot ID (nombre#TAG) + region.
4. **First real validation pass** (this closes most pending acceptance criteria — log results in
   `docs/worklog.md`):
   - `npm run dev` with the LoL client closed → app stays idle, no error spam (WP-001).
   - Open client → lobby → champ select → game → post-game: phases must track correctly (WP-005);
     kill the client mid-cycle once, it must reconnect.
   - Play ≥1 game with recording ON → real payload parses with zero zod errors (or list failing
     fields in the worklog) → `npm run fixtures:anonymize` → commit early/mid/late snapshots,
     replacing/augmenting the synthetic ones in `fixtures/liveclient/` (WP-001, WP-006).
   - Sync full history (200 matches, zero 429s expected in the log; kill mid-sync once and
     verify resume) (WP-004). Consider re-recording `fixtures/riot/` from a real response.
   - Finish a game → appears in Historial within 5 min without manual action (WP-010).
   - Judge recommendations in ≥3 real games; capture feedback in the worklog (WP-009).
5. **Backtest on real data**: `npm run backtest -- --last 100` → bring the report to the reviewer;
   drive ONE tuning pass of `src/main/engine/rules/thresholds.ts` from it (WP-011 criterion —
   deliberately not done against synthetic data, it would be circular).

## Open decisions & known gaps

- **ADR-006 (blocking real usefulness of WP-009)**: `src/main/engine/baselines/pool.json` is a
  PLACEHOLDER pool (Jinx/Ahri/Malphite/Vi/Leona). Owner must provide his real 10–15 champion pool
  (champion + role); schema tests validate it automatically. Baselines should then be curated
  per champion (core order + situationals).
- **ADR-007 (open)**: personal use assumed — no code signing, no distribution, personal API key.
- `backlog/INBOX.md` items (reviewer triages): per-champion ddragon detail files on demand;
  verify damage profiles of Locke/Yunara/Zaahen; derive gold-per-stat table per patch; real
  recorded API fixtures; dynamic per-method rate limits from response headers; champion
  cross-check on post-game session linking.
- Review checklist deviations flagged in the worklog for the reviewer, most notably:
  Live Client transport skips hostname verification ONLY for the pinned-CA loopback connection
  (`src/main/liveclient/transport.ts`, documented rationale); icons hit the CDN once each before
  being cached; JSON columns are structurally (not schema-) validated on read.

## Phase 2 (do not start without reviewer sign-off — see backlog/README.md)

Draft order from the original plan: overlay window (transparent, always-on-top; revisit ADR-005
if playing single-monitor fullscreen) → champ select recommendations over the LCU →
rune auto-import (`/lol-perks/v1/pages`, endpoint already listed in docs/lcu-endpoints.md).
Phase 3 ideas parked: high-elo mining via GitHub Actions, personal analytics, ML win-probability
(gated on a validated backtest baseline).

## Environment notes (macOS side, for reference)

- Node 25 / npm 11 on the Mac; Electron 43 bundles Node 24. Single-ABI strategy: everything
  (tests, backtest CLI) runs through Electron's Node. Vite pinned ^7 (electron-vite 5 requirement),
  React 18 per CLAUDE.md, TypeScript 6 (no `baseUrl`).
- The GitHub remote is HTTPS (`https://github.com/carlo23666/lolcompanion.git`); the Mac's SSH key
  belongs to a different GitHub account (carlo-mgd), so keep HTTPS on the Mac. On Windows,
  authenticate as carlo23666 (browser credential manager or a PAT).
- CI (`.github/workflows/check.yml`) runs `npm run check` on ubuntu — first push after the
  Windows fixes should confirm it's green (never yet observed running).
