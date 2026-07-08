import { createContext, useContext, useMemo } from 'react'
import { createTranslator, DEFAULT_LOCALE, type Locale, type Translator } from '@shared/i18n'

/**
 * Renderer i18n (ADR-009): a translator + the active locale in context,
 * rebuilt when the locale changes. Components call `useT()` and translate
 * with `t('key', params)`; `useLocale()` gives the code (e.g. for
 * Intl date formatting). Locale changes flow through the `app-locale` window
 * event (mirrors the theme mechanism) so a save in Settings updates the tree.
 */
interface I18nValue {
  t: Translator
  locale: Locale
}

const I18nContext = createContext<I18nValue>({
  t: createTranslator(DEFAULT_LOCALE),
  locale: DEFAULT_LOCALE
})

export function LocaleProvider(props: {
  locale: Locale
  children: React.ReactNode
}): React.JSX.Element {
  const value = useMemo<I18nValue>(
    () => ({ t: createTranslator(props.locale), locale: props.locale }),
    [props.locale]
  )
  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>
}

export function useT(): Translator {
  return useContext(I18nContext).t
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale
}

/** BCP-47 tag for Intl APIs (dates, numbers). */
export function intlLocale(locale: Locale): string {
  return locale === 'es' ? 'es-ES' : 'en-US'
}

/** Broadcasts a locale change so App re-renders the provider (like applyTheme). */
export function applyLocale(locale: Locale): void {
  window.dispatchEvent(new CustomEvent('app-locale', { detail: locale }))
}
