/**
 * i18n core types (WP-017 / ADR-009). Zero-dep message catalog: `en` is the
 * source of truth, `es` must satisfy the same keys (enforced in es.ts). A
 * Translator is a locale-bound `t(key, params)` — threaded into the pure
 * engine and provided to the renderer via context.
 */
import type { en } from './en'

export type Locale = 'en' | 'es'
export const LOCALES: Locale[] = ['en', 'es']
export const DEFAULT_LOCALE: Locale = 'en'

/** All valid message keys, derived from the English source-of-truth catalog. */
export type MessageKey = keyof typeof en

/** Interpolation values; numbers are stringified as-is (caller pre-formats). */
export type TParams = Record<string, string | number>

export type Translator = (key: MessageKey, params?: TParams) => string

/** A full catalog: every key present (TypeScript enforces this on es.ts). */
export type Catalog = Record<MessageKey, string>

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es'
}

/** UI labels for the language picker (shown in each language's own name). */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español'
}
