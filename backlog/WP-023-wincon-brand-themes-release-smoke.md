# WP-023 — WinCon brand, Dark/Sakura identities, public site and release smoke

## Why

The owner selected **WinCon** as the product name and the first route-signal logo direction. The
single Rift identity is useful but removed desired personalization. Dark and Sakura concepts —
including the original mascots Sombra and Kohaku — are approved for production. The app, public
site, installer and updater must present one coherent identity before the branch is proposed for
merge.

## Scope

- Replace the LoL Companion/Hexi product lockup with WinCon. Hexi remains the Rift mascot; Sombra
  and Kohaku are the Dark/Sakura mascots. Keep Riot's required independent-project disclosure.
- Build the selected route-signal mark as a deterministic, vector-native logo. Use it in the app
  shell, renderer document, website, runtime/installer icon and release metadata.
- Restore a three-theme selector: Rift, Dark and Sakura. Each identity must have deliberate color,
  surface, typography, atmosphere, logo treatment and an authored six-pose bitmap mascot sheet.
- Update EN/ES landing pages and captures to the current WinCon app, themes and stable bottom
  overlay. Preserve the static, zero-cost GitHub Pages deployment.
- Keep the existing `appId`, GitHub repository and update feed so installed LoL Companion builds
  can update into WinCon. Change only the visible `productName` and artifact filename.
- Validate typecheck/lint/tests, browser layouts, a real local NSIS build and the
  packaged updater metadata. Open the updated development app and Spanish site for owner review.

## Acceptance criteria

- [x] App/site/document titles, primary lockups, updater copy and install docs say WinCon; Hexi is
  only a mascot/persona name.
- [x] Selected route-signal logo is crisp at sidebar, favicon and 256px installer sizes; no Riot
  logo, rank, item, champion or Nexus geometry is copied.
- [x] Rift, Dark and Sakura are selectable, preview instantly, persist through settings and resolve
  correctly from legacy ids.
- [x] Hexi, Sombra and Kohaku each render six semantic poses and all animation respects
  `prefers-reduced-motion`.
- [x] Dark is adult cyber-gothic black/crimson; Sakura is calm Japanese editorial ivory/plum/pink,
  with readable contrast across Live, draft, history, settings and overlay.
- [x] EN/ES landing pages reflect WinCon, the current overlay and the three identities; all images
  load and desktop/mobile have no horizontal overflow.
- [x] `npm run check` and `npm run dist` pass without publishing. `dist/latest.yml` points to the
  WinCon installer/blockmap, the packaged app contains `app-update.yml`, and `appId`/GitHub feed
  remain update-compatible.
- [x] Worklog records files, checks, deviations and generated-asset provenance. No paid service,
  dependency or Riot-policy violation is introduced.
- [x] App and site are opened locally for owner approval. No push, PR or merge occurs before that
  approval.

## Out of scope

- Renaming the GitHub repository or changing update provider.
- Code signing, paid domains, telemetry or backend services.
- Pushing, publishing a release or merging into `main` before the owner approves the local build.
