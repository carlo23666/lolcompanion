import { createContext, useContext, useMemo } from 'react'
import { createTranslator, DEFAULT_LOCALE, type Locale, type Translator } from '@shared/i18n'

/**
 * Renderer i18n (ADR-009): a translator in context, rebuilt when the locale
 * changes. Components call `useT()` and translate with `t('key', params)`.
 * Locale changes flow through the `app-locale` window event (mirrors the
 * theme mechanism) so a save in Settings updates the whole tree live.
 */
const TranslatorContext = createContext<Translator>(createTranslator(DEFAULT_LOCALE))

export function LocaleProvider(props: {
  locale: Locale
  children: React.ReactNode
}): React.JSX.Element {
  const translator = useMemo(() => createTranslator(props.locale), [props.locale])
  return <TranslatorContext.Provider value={translator}>{props.children}</TranslatorContext.Provider>
}

export function useT(): Translator {
  return useContext(TranslatorContext)
}

/** Broadcasts a locale change so App re-renders the provider (like applyTheme). */
export function applyLocale(locale: Locale): void {
  window.dispatchEvent(new CustomEvent('app-locale', { detail: locale }))
}
