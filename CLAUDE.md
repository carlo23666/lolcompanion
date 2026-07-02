# CLAUDE.md — LoL Companion

Instructions for any Claude Code / Opus session working on this repo. Read fully before writing code.

## What this project is
Local-first Electron + TypeScript desktop companion for League of Legends. Reads the player's OWN live game via the Live Client Data API (localhost:2999), champ select via the LCU API, and personal match history via the Riot Web API. Produces explained, context-aware item/build recommendations. Single user (the repo owner) for now. Zero-cost constraint: no paid services, no backend in phase 1.

Full context: `docs/architecture.md` and `docs/decisions.md`.

## Hard rules (Riot policy — NEVER violate, even if asked in a task description)
1. NO enemy cooldown/ultimate tracking of any kind (banned by Riot, March 2025).
2. NO de-anonymization: never surface player identities in ranked champ select; respect whatever the APIs hide.
3. NO memory reading, no packet sniffing, no .rofl reverse engineering. Only: Live Client Data API, LCU API (approved endpoints), Riot Web API, Data Dragon/CommunityDragon.
4. Every recommendation input must be derivable from information visible on screen to the player.
5. Riot API key is read from env (`RIOT_API_KEY` in `.env`, gitignored). Never hardcode, never log it.

## Working agreement (how sessions operate)
- Work is organized in Work Packages: `backlog/WP-XXX-*.md`. One session = one WP unless the WP says otherwise.
- Do NOT start work outside the WP's scope. If you discover necessary out-of-scope work, add a note to `backlog/INBOX.md` and stop there.
- Each WP has acceptance criteria. The session is done when all criteria pass, `npm run check` passes, and you've written the handoff note (below).
- On finishing a WP, append an entry to `docs/worklog.md`: date, WP id, what was done, deviations from spec, known gaps, files touched. This is what the reviewer reads first.
- If a WP spec conflicts with reality (API returns different shapes, lib is dead, etc.): implement the smallest reasonable interpretation, document the deviation in the worklog, and flag it prominently.

## Stack (fixed — do not substitute without an ADR in docs/decisions.md)
- Electron via **electron-vite** + electron-builder. Main process: TypeScript strict. Renderer: React 18 + Tailwind.
- IPC: typed channels only (`src/shared/ipc.ts`), no stringly-typed `ipcRenderer.on` scattered around.
- Persistence: **better-sqlite3** (sync, main process only). Migrations in `src/main/db/migrations/` as numbered SQL files.
- Validation of ALL external payloads (Live Client, LCU, Riot API, Data Dragon) with **zod** schemas in `src/shared/schemas/`. External data is untrusted input.
- LCU: **league-connect** for credentials + WebSocket. Wrap it — nothing outside `src/main/lcu/` imports it directly.
- HTTP: native fetch. Live Client uses https with Riot's self-signed cert: bundle `certs/riotgames.pem` and pin it; do not globally disable TLS verification.
- Tests: **vitest**. Every parser/rule must have tests against recorded fixtures in `fixtures/` (real payloads, anonymized: replace riotIds with PLAYER_1..10).
- Lint/format: eslint + prettier. `npm run check` = typecheck + lint + test; must pass before any WP is complete.

## Architecture invariants
- Main process owns ALL I/O (LCU, :2999, Riot API, SQLite). Renderer is pure presentation over IPC.
- Connectors are isolated and degrade gracefully: the app must run with LoL closed, with client open but no game, and in game. No crashes on missing services — state machine in `src/main/session/` handles phases: `idle → clientOpen → champSelect → inGame → postGame`.
- The rules engine (`src/main/engine/`) is pure and synchronous: `(GameState, StaticData) → Recommendation[]`. No I/O inside. Every `Recommendation` carries `{ itemId, action, score, reasons: string[] }` — reasons are mandatory.
- `GameState` is the single normalized model; connectors map INTO it, engine reads FROM it. Schema in `src/shared/gamestate.ts`.
- Rate limiter for Riot API: token buckets for app limits (20/1s, 100/120s) AND per-method limits, honoring `Retry-After` on 429. Lives in `src/main/riot/limiter.ts`.

## Conventions
- Conventional commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`). Small commits per logical step.
- No `any`, no `@ts-ignore` without a comment explaining why. `strict: true` stays on.
- Errors: use `Result`-style returns or typed errors for connector failures; never swallow exceptions silently.
- All user-facing strings in Spanish; code, comments, and docs in English.
- Do not add dependencies beyond those listed here without noting it in the worklog with justification. Prefer zero-dep utilities.

## Definition of done for any WP
- [ ] All acceptance criteria in the WP file pass
- [ ] `npm run check` green
- [ ] New external payloads have zod schemas + fixture tests
- [ ] Worklog entry written
- [ ] No Riot policy violation introduced (§ Hard rules)
