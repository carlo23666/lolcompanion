# WP-017 — App i18n: English default, Spanish second (owner request 2026-07-08)

## Problem
The owner wants to reach a wider audience: English as the app's default and primary
language, Spanish as the second. Today Spanish is a hard convention (CLAUDE.md:
"All user-facing strings in Spanish") baked into EVERY user-facing string — renderer
components, engine recommendation reasons (built dynamically with templates and
numbers), champ-select tips, weakness insights, coach personas, updater dialogs,
INSTALAR.md.

## Why this is its own WP (not a quick change)
- Engine reasons are the product and are assembled programmatically in ~10 modules
  (rules, nextbuy, meta-items, exclusivity, weaknesses, champselect) — they need a
  message-catalog layer with parameterized templates, not string swaps.
- The mascot/coach personas have voice/tone per language, not just translations.
- The backtest fixtures and several tests assert Spanish substrings.
- CLAUDE.md's language convention must be REWRITTEN as part of this WP (needs the
  ADR below), or every future session will keep writing Spanish strings.

## Direction (to spec in detail when scheduled)
- Zero-dep message catalog: `src/shared/i18n/` with `en.ts` (source of truth) +
  `es.ts`, typed keys, `t(key, params)` helper usable from main AND renderer
  (engine stays pure: locale passed in or strings resolved at the edge).
- Locale setting in Ajustes/Settings (default: en; existing installs keep es via a
  migration of the settings row).
- Engine emits structured reason data where practical; the template renders per
  locale at the IPC edge.
- Coach personas: per-locale persona text.
- Docs: INSTALL.md (en) alongside INSTALAR.md.
- ADR-009: language policy change (EN default), CLAUDE.md convention update.

## Acceptance criteria (draft)
- [ ] Every user-facing string flows through the catalog; no hardcoded Spanish left
      in renderer or main (lint/grep gate).
- [ ] Locale toggle in settings applies live; default en, existing installs es.
- [ ] Engine reason tests run against both locales.
- [ ] CLAUDE.md + ADR-009 updated.
- [ ] `npm run check` green; worklog entry.
