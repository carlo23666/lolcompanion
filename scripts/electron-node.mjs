/**
 * Cross-platform launcher: runs a script under Electron's bundled Node
 * (ELECTRON_RUN_AS_NODE=1). Replaces the POSIX-only `VAR=1 electron …`
 * prefix in npm scripts, which breaks on cmd/PowerShell.
 * Usage: node scripts/electron-node.mjs <script> [args…]
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

// The electron package's main export is the path to the binary.
const electron = createRequire(import.meta.url)('electron')

const result = spawnSync(electron, process.argv.slice(2), {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: 'inherit'
})
process.exit(result.status ?? 1)
