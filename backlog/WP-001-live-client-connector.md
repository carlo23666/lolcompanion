# WP-001 — Live Client connector + payload recorder

## Objective
Reliable polling of https://127.0.0.1:2999/liveclientdata/allgamedata with recorded fixtures for all later work.

## Scope
- `src/main/liveclient/`: poller with states `unavailable → polling`, 2s interval, exponential backoff when port closed (max 10s), pinned Riot cert (no global TLS disable).
- zod schema `src/shared/schemas/liveclient.ts` for allgamedata: activePlayer, allPlayers (items, scores, level, position, spells, isDead, respawnTimer), events, gameData. Unknown fields tolerated (passthrough), required fields validated.
- Recorder mode (env `RECORD_LIVE=1`): dumps every raw snapshot to `fixtures/recordings/<date>/<gametime>.json`.
- Anonymizer script `npm run fixtures:anonymize` replacing riotIds/summonerNames with PLAYER_1..10.
- IPC channel `live:snapshot` pushing validated snapshots to renderer; placeholder view showing raw game time + player list.
- Unit tests: schema against the official sample payload (static.developer.riotgames.com/docs/lol/liveclientdata_sample.json, committed to fixtures) + malformed payload rejection.

## Acceptance criteria
- [ ] App runs with LoL closed (stays `unavailable`, no error spam) and transitions to `polling` when a game starts.
- [ ] One real recorded game (owner does this) parses fully with zero zod errors, or every failing field is listed in the worklog.
- [ ] Fixtures committed: official sample + ≥1 anonymized real snapshot set (early/mid/late game).

## Out of scope
GameState normalization (WP-006). Any recommendation logic.

## Review checklist
Cert pinning not bypassed; backoff verified; recorder excluded from prod build path; anonymization actually applied to committed fixtures.
