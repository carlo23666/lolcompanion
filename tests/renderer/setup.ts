import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import type { RendererApi } from '@shared/ipc'

// RTL auto-cleanup needs vitest globals; we keep globals off, so do it here.
afterEach(() => {
  cleanup()
})

// Default no-op window.api so presentational components that read from IPC
// (e.g. usePersonalCurve) render in tests without a stub. Tests that need
// specific behavior override it with vi.stubGlobal('api', …).
const noopApi: RendererApi = {
  invoke: () => Promise.resolve(null as never),
  on: () => () => undefined
}
if (!('api' in window)) {
  Object.defineProperty(window, 'api', { value: noopApi, writable: true, configurable: true })
}
