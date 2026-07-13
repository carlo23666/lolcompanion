# WP-026 — Complete WinCon landing refresh

## Why

The public site must represent the approved WinCon identity and the current product rather than
older application captures or incomplete feature positioning.

## Scope

- Review and update the English and Spanish landing pages end to end: name/logo lockup, metadata,
  positioning, feature descriptions, trust/compliance copy, theme/companion presentation, FAQ and
  calls to action.
- Represent the shipped decision engine, contextual build routes, draft support, live overlay,
  personal statistics, post-game reports, Master+ aggregate base, local-first/privacy model and
  optional experimental local coach accurately.
- Recapture every product screenshot from the current renderer, including the movable/scalable
  themed overlay, with matching EN/ES images and current WinCon branding.
- Keep the site static, zero-cost and compatible with the existing GitHub Pages workflow.
- Stage locally, validate desktop/mobile behavior and leave the refreshed site open for review.

## Acceptance criteria

- [x] EN/ES pages use current WinCon name, logo, identity and adult product voice throughout.
- [x] Claims and feature descriptions match shipped behavior and Riot-policy boundaries.
- [x] All product captures show the current app, current themes and current overlay.
- [x] Internal links, language switch, release CTA and staged asset paths work locally.
- [x] Desktop and mobile layouts have no horizontal overflow or console errors.
- [x] `npm run check` passes and the refreshed staged site remains open for owner review.

## Out of scope

- Publishing GitHub Pages, creating a release, pushing, merging or changing repository/domain names.
- Adding analytics, paid hosting, backend services or a bundled local-AI model.
