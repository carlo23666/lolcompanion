# WP-021 — Professionalization overhaul: decision engine, product UX, mascot and site

## Why

The owner asked for one coordinated pass over the product rather than another isolated
threshold tweak. The current engine can let flat item frequencies and reactive rules
override champion power curves; the UI has several competing identities; the mascot is
code-motion rather than authored character animation; and the public site overstates the
support/compliance status of the data sources.

This WP explicitly authorizes the integrated scope below in one session. Keeping it in a
single package is intentional: the new decision contract, renderer hierarchy, overlay,
mascot states and public screenshots must describe the same product.

## Scope

### A. Build-route intelligence

- Aggregate anonymized champion+role build routes from ranked Master+ timelines, including
  the first starter and ordered finished items; persist them in a numbered migration and
  ship them in a backwards-compatible seed schema.
- Replace the flat “top five items are core” model with route selection and phase-aware
  targets. Old v1/v2 seeds and curated pool entries remain graceful fallbacks.
- Keep the first two non-boots route items protected from ordinary situational rules.
  Emergency deviations require a genuinely ahead relevant threat and Master+ support.
- Remove raw personal item-win-rate substitution. Personal history may prefer a route or
  stable opener only with a meaningful role-aware sample and Bayesian shrinkage.
- Recommend starters before the first shop exit when route data exists. Preserve component,
  boots, exclusivity, Magical Footwear and endgame behavior.
- Treat team damage balance as a route-selection signal only when Master+ exposes multiple
  valid routes; never invent off-role items.

### B. Evaluation and explanations

- Add golden regression scenarios for early core protection, supports, fed-vs-behind
  threats, starter purchases and multi-route damage balance.
- Extend the backtest report with coverage and phase metrics while documenting that player
  purchase agreement is a regression signal, not ground truth.
- Present recommendations as explained options with confidence/evidence, not commands.

### C. Product experience and mascot

- Consolidate the app to one professional visual identity and one mascot.
- Rebuild the live screen around: what changed → primary route → 2–3 options → evidence;
  demote secondary telemetry and make empty states intentional.
- Rebuild the overlay to remain useful at a glance without dictating play.
- Replace the code-drawn multi-mascot implementation with a project-owned bitmap character
  asset and event-driven authored animation states. Respect reduced-motion preferences.
- Keep every display string in the English and Spanish catalogs.

### D. Public site

- Correct the LCU/API-key/compliance claims and use careful, factual language.
- Align the site with the consolidated product identity.
- Refresh the versioned app/overlay screenshots after visual QA.

## Acceptance criteria

- [x] Migration 009 stores route aggregates idempotently; crawler, repository and seed v3
  round-trip starter + ordered route data; v1/v2 seeds still import.
- [x] Route resolver prefers a coherent Master+ sequence and falls back cleanly with old
  aggregate data, personal history or the bundled pool.
- [x] Empty inventory can receive a route-backed starter recommendation.
- [x] Before two non-boots core completions, an ordinary comp-only armor/MR, antiheal,
  anti-tank or anti-burst suggestion cannot outrank the route target.
- [x] A support cannot receive an unbacked carry/tank item; an assassin who is behind does
  not trigger an emergency defensive deviation.
- [x] Personal data never swaps a core item solely because “win rate when built” is high;
  role-aware route preference is sample-gated and shrunk toward the Master+ prior.
- [x] Team damage balance chooses between two observed valid routes in a deterministic test.
- [x] Main live view and overlay expose route progress, option/evidence hierarchy and
  non-command wording in both locales.
- [x] One bitmap mascot with at least five semantic animation states is integrated; reduced
  motion disables non-essential animation.
- [x] Site policy wording is factual: Live Client is documented, LCU is unsupported, public
  Riot API access requires product registration/production-key review; no account-safety
  guarantee remains.
- [x] Versioned screenshots match the implemented app and site.
- [x] `npm run check` and `npm run backtest -- --last 100` pass; results and known limits are
  recorded in `docs/worklog.md`.
- [x] No Riot policy hard rule is violated.

## Out of scope

- Enemy cooldown/ultimate tracking, hidden-position inference, packet/memory access or
  de-anonymization.
- A hosted backend, production key, paid service, telemetry SaaS or new dependency.
- Exact “recall now”/ward-placement commands when wave, position or trinket-charge state is
  not available from approved visible inputs.
