import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Minimal zero-dependency .env loader. Only sets variables that are not
 * already defined in the process environment. The API key never leaves
 * process.env — never log it.
 */
export function loadDotEnv(dir: string): void {
  const path = join(dir, '.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}
