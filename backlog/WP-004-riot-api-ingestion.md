# WP-004 — Riot API client + rate limiter + history ingestion

## Objective
Ingest the owner's full match history (match-v5 + timelines) into SQLite without ever hitting 429s.

## Scope
- `src/main/riot/`: typed client for account-v1 (riotId→puuid), match-v5 (ids, match, timeline), league-v4 entries. Region config (EUW/europe) in settings.
- Token-bucket limiter honoring app limits (20/1s, 100/120s) + per-method limits, queue with priorities, `Retry-After` handling, persistent backoff on 403 (bad key → surface to UI, don't loop).
- Ingestion job: given puuid, walk matchlist newest→oldest, skip already-stored, store match+timeline via WP-003 repos; resumable; progress events over IPC (`ingest:progress`).
- Settings UI stub: riotId input, "Sync history" button, progress bar.
- Tests: limiter unit tests (bucket math, 429 replay) with fake clock; client tests against recorded fixture responses (record one real match + timeline, anonymize).

## Acceptance criteria
- [ ] Full sync of owner's last 200 matches completes with zero 429s in the log (owner runs this).
- [ ] Kill app mid-sync → relaunch resumes without re-downloading stored matches.
- [ ] Invalid API key path shows a clear UI error, no retry storm.

## Out of scope
High-elo mining (phase 3). Any analysis of the data.

## Review checklist
Key from env only, never logged; limiter tested with fake timers not sleeps; ingestion uses repos, no ad-hoc SQL.
