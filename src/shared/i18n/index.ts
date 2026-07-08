import { en } from './en'
import { es } from './es'
import {
  DEFAULT_LOCALE,
  isLocale,
  type Catalog,
  type Locale,
  type MessageKey,
  type TParams,
  type Translator
} from './types'

export {
  DEFAULT_LOCALE,
  isLocale,
  LOCALES,
  LOCALE_LABELS,
  type Catalog,
  type Locale,
  type MessageKey,
  type TParams,
  type Translator
} from './types'

const CATALOGS: Record<Locale, Catalog> = { en, es }

const INTERPOLATION = /\{(\w+)\}/g

/** Replaces `{name}` tokens with params; a missing param leaves the token. */
function interpolate(template: string, params: TParams | undefined): string {
  if (params === undefined) return template
  return template.replace(INTERPOLATION, (whole, name: string) =>
    name in params ? String(params[name]) : whole
  )
}

/**
 * Builds the `t(key, params)` function for a locale. Falls back to English
 * for any key missing in the target catalog (can't happen while the Catalog
 * type holds, but stays safe if a catalog is ever loaded loosely).
 */
export function createTranslator(locale: Locale): Translator {
  const catalog = CATALOGS[locale] ?? en
  return (key: MessageKey, params?: TParams) =>
    interpolate(catalog[key] ?? en[key] ?? String(key), params)
}

/** Coerces any stored/loaded value to a valid locale (default: en). */
export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** Ready-made translators (the engine's default is Spanish for back-compat). */
export const t = { en: createTranslator('en'), es: createTranslator('es') }
