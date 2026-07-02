import { it } from 'vitest'
import { runCliBacktest } from '@main/backtest/cli'

/**
 * Not a test: the executable body of `npm run backtest` (see
 * scripts/backtest.mjs for why it runs through vitest).
 */
it('backtest', async () => {
  await runCliBacktest({
    champion: process.env['BACKTEST_CHAMPION'],
    last:
      process.env['BACKTEST_LAST'] !== undefined
        ? Number(process.env['BACKTEST_LAST'])
        : undefined,
    dbPath: process.env['BACKTEST_DB']
  })
})
