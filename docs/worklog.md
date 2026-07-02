# Worklog
Builder sessions append entries here (date, WP, summary, deviations, gaps, files touched). Newest first.

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
