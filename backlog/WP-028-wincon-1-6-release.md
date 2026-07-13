# WP-028 — WinCon 1.6 overlay intelligence and release

## Why

The final WinCon branch still lacks two owner-requested live-overlay signals and its existing
1.5.0 installer predates the latest overlay, theme and site work. The complete batch must be
validated, versioned and published as one update-compatible release.

## Scope

- Carry typed item references into transient recall/next-buy overlay speech and render the Data
  Dragon item icon plus localized item name without parsing generated prose.
- Add a pure, conservative 1v1 material-advantage signal using only screen-visible scoreboard
  state: levels, health percentage, purchased-item value/completed items, CS and KDA. Never track
  cooldowns or claim hidden enemy gold, fog or incoming-help knowledge.
- Bump the app to 1.6.0, rebuild the NSIS installer and validate packaged metadata, launch and
  update compatibility with the established GitHub feed/app identity.
- Remove local preview artifacts, resolve superseded INBOX entries, update release/worklog docs and
  create conventional commits.
- Push `testing-codex`, merge it into `main`, publish tag/release `v1.6.0` with updater assets and
  verify the GitHub Pages deployment.

## Acceptance criteria

- [x] Item-related overlay speech receives typed `itemId`/localized `itemName` and visibly renders
  the matching `ddicon://item/...` image without changing non-item alerts.
- [x] A tested pure 1v1 signal fires only for a clear visible material lead, stays conditional and
  remains silent for ambiguous/even states.
- [x] No Riot-policy violation, external payload bypass or hidden-information inference is added.
- [x] `npm run check` and `npm run dist` pass at version 1.6.0.
- [x] Installer, blockmap, `latest.yml`, packaged `app-update.yml`, packaged launch and updater feed
  compatibility are validated.
- [x] Worktree hygiene and documentation are complete; changes are committed and pushed.
- [x] `main` contains the batch, `v1.6.0` release assets are published and Pages serves the updated
  WinCon site.

## Out of scope

- Bundling or redesigning the optional local-AI coach.
- Enemy cooldowns, summoner timers, hidden gold, fog inference or player de-anonymization.
- Paid signing, hosting, analytics, backend services or repository/domain renaming.
