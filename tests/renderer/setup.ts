import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// RTL auto-cleanup needs vitest globals; we keep globals off, so do it here.
afterEach(() => {
  cleanup()
})
