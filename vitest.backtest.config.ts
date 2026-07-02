import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/** Config for the backtest CLI runner (scripts/backtest.mjs). */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(import.meta.dirname, 'src/shared'),
      '@main': resolve(import.meta.dirname, 'src/main')
    }
  },
  test: {
    include: ['scripts/backtest.runner.ts'],
    environment: 'node',
    testTimeout: 300_000,
    // The runner IS the program; show its console output.
    disableConsoleIntercept: true
  }
})
