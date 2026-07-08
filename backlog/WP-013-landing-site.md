# WP-013 — Landing website (GitHub Pages)

## Problem
The app has installers on GitHub Releases but no way for anyone to discover it or judge
whether it's safe. Owner request 2026-07-08: a simple promo page to send people to.

## Approach
Zero-cost static page on GitHub Pages, deployed by a GitHub Action. No framework, no build
step: one self-contained `site/index.html` (hand-written CSS inline, no JS dependencies),
visually aligned with the app's neon identity. Screenshots are NOT duplicated into `site/`;
the deploy workflow stages `docs/media/*.png` into the published artifact.

Content (Spanish — user-facing): hero + download CTA (`releases/latest`), screenshots,
feature grid, a prominent "¿Es seguro?" compliance section (the #1 question for any LoL
tool), "Cómo empezar" steps mirroring `docs/INSTALAR.md` (SmartScreen warning + Riot API
key), FAQ, and the Riot legal boilerplate + PolyForm license in the footer.

## Scope
- `site/index.html` (+ `site/README.md` explaining the deploy).
- `.github/workflows/site.yml`: on push to main touching `site/**` or `docs/media/**`,
  stage site + media + icon and deploy via `actions/deploy-pages`.
- README link to the site.

Out of scope: custom domain, analytics, download counters, i18n of the page.

## Owner actions (one-time)
- Repo Settings → Pages → Source: **GitHub Actions** (the workflow fails until this is set).
- After first deploy, verify https://carlo23666.github.io/lolcompanion/ renders.

## Acceptance criteria
- [ ] `site/index.html` is self-contained (no external requests except the repo's own
      media), responsive, Spanish, and contains: download CTA, both screenshots,
      compliance section, install steps incl. SmartScreen + API key, FAQ, Riot disclaimer.
- [ ] Deploy workflow stages media from `docs/media/` (no image duplication in git).
- [ ] README links to the site.
- [ ] No new npm dependencies.
