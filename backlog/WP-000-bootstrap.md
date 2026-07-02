# WP-000 — Repo bootstrap

## Objective
Empty repo → running Electron app with the full toolchain from CLAUDE.md, so every later WP starts from a working `npm run check`.

## Scope
- electron-vite scaffold (main / preload / renderer), TypeScript strict everywhere.
- React 18 + Tailwind in renderer; placeholder window "LoL Companion" with app version.
- Typed IPC skeleton: `src/shared/ipc.ts` with one demo channel (`app:ping`).
- better-sqlite3 wired in main with migration runner (`src/main/db/`), migration 001 creating `meta` table.
- vitest + eslint + prettier; scripts: `dev`, `build`, `check` (typecheck+lint+test), `test`.
- `.env.example` with `RIOT_API_KEY=`; `.env` gitignored. `certs/riotgames.pem` placeholder README.
- CI: GitHub Actions running `npm run check` on push.

## Acceptance criteria
- [ ] `npm run dev` opens the window; `npm run check` green; CI green.
- [ ] Renderer can call `app:ping` and display the reply (proves IPC + preload isolation with contextIsolation on, nodeIntegration off).
- [ ] Migration runner applies 001 idempotently (run twice, no error).

## Out of scope
Any LoL API code. Any real UI.

## Review checklist
contextIsolation/nodeIntegration settings; strict tsconfig; no `any`; lockfile committed; deps match CLAUDE.md list.
