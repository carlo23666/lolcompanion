/**
 * CLI wrapper: `npm run backtest -- --champion Jinx --last 50`
 * The harness is TypeScript with path aliases and needs the Electron-ABI
 * better-sqlite3 build, so it runs through vitest under Electron's node
 * (same trick as `npm test`). This wrapper just parses args into env vars.
 */
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--champion' && args[i + 1]) env.BACKTEST_CHAMPION = args[++i]
  else if (args[i] === '--last' && args[i + 1]) env.BACKTEST_LAST = args[++i]
  else if (args[i] === '--db' && args[i + 1]) env.BACKTEST_DB = args[++i]
}

const result = spawnSync(
  'npx',
  [
    'electron',
    'node_modules/vitest/vitest.mjs',
    'run',
    '--config',
    'vitest.backtest.config.ts'
  ],
  { env, stdio: 'inherit' }
)
process.exit(result.status ?? 1)
