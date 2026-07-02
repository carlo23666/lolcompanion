# WP-003 — SQLite store + schema

## Objective
Persistence layer for matches, timelines, and live-game recordings.

## Scope
- Migrations: `matches` (matchId PK, queue, patch, gameCreation, durationS, win, raw JSON), `participants` (matchId, puuid, champion, role, items0-6, aggregates: kda, cs, gold, damage, vision), `timelines` (matchId PK, raw JSON), `live_sessions` (id, startedAt, patch, championId, result nullable) + `live_snapshots` (sessionId, gameTimeS, raw JSON).
- Repository layer `src/main/db/repos/` with typed methods (insertMatch idempotent, getMatchesByChampion, latestMatches, etc.). No SQL outside repos.
- Wire WP-001 recorder to also persist snapshots into `live_sessions/live_snapshots` (file recorder stays for fixtures).

## Acceptance criteria
- [ ] Idempotent inserts (same match twice → one row) tested.
- [ ] Repo round-trip tests for every table using fixtures from WP-001.
- [ ] DB file lives in userData; size after one recorded game < 20MB (raw JSON is fine at 2s cadence, verify).

## Out of scope
Riot API ingestion (WP-004). Query UI.

## Review checklist
Migrations numbered & immutable; indices on (participants.champion), (matches.gameCreation); JSON columns validated on read with zod.
