# WP-014 — CI release pipeline (draft releases)

## Problem
Releases are built and uploaded by hand from the owner's Windows PC. The 1.4.0–1.4.2
incident (three broken installers shipped to auto-updating users) showed the cost of a
manual pipeline with no gate. Owner request 2026-07-08 (go-public track).

## Approach
GitHub Actions workflow on tag push (`v*`): windows runner, `npm ci` → `npm run check` →
`npm run dist -- --publish never` → create a **draft** GitHub release with the artifacts
the updater feed requires (setup exe, `latest.yml`, `.blockmap`) and carry
`meta-seed.json.gz` over from the previous published release (CI has no local meta DB;
the seed only changes when the owner re-exports it).

**Draft by design**: the mandatory packaged smoke test (worklog 2026-07-07 (19) — launch
the installed build, confirm window + updater.log) cannot run headless in CI. The owner
downloads the installer from the draft, smoke-tests, and presses Publish. Auto-updating
users can never receive an unsmoked build.

## Scope
- `.github/workflows/release.yml`.
- No changes to `electron-builder.yml` or app code.

Out of scope: code signing (needs a cert — separate ADR/decision), macOS/Linux targets,
auto-publishing.

## Owner actions
- Nothing one-time; per release: `git tag vX.Y.Z && git push --tags`, wait for the draft,
  download installer, smoke-test, publish. Re-upload a fresh `meta-seed.json.gz` first
  when the local aggregates deserve it (`npm run meta:export`).

## Acceptance criteria
- [ ] Tag push produces a draft release with setup exe + latest.yml + blockmap attached.
- [ ] `npm run check` gates the build (red check = no artifacts).
- [ ] meta-seed.json.gz carried from the previous release when present; build does not
      fail when absent.
- [ ] Release stays a draft; publishing is manual (smoke-test rule documented in the
      workflow file).
