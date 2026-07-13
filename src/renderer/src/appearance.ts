import { normalizeTheme } from '@shared/themes'

/** Apply an identity to this renderer and notify theme-aware components. */
export function applyTheme(theme: string): void {
  const normalized = normalizeTheme(theme)
  document.documentElement.dataset['theme'] = normalized
  window.dispatchEvent(new CustomEvent('app-theme', { detail: normalized }))
}
