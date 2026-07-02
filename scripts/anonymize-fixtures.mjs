/**
 * Anonymizes recorded Live Client fixtures in-place:
 * every distinct riotId/summonerName becomes PLAYER_1..PLAYER_10 (mapping is
 * consistent across all files of the same recording directory), taglines
 * become "TAG". Run: `npm run fixtures:anonymize`.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RECORDINGS_DIR = join(import.meta.dirname, '..', 'fixtures', 'recordings')
const IDENTITY_KEYS = new Set(['summonerName', 'riotId', 'riotIdGameName'])

function anonymizeValue(value, mapping) {
  // riotId may be "name#TAG" — map by the name part.
  const [name] = String(value).split('#')
  if (!mapping.has(name)) {
    mapping.set(name, `PLAYER_${mapping.size + 1}`)
  }
  return mapping.get(name)
}

function walk(node, mapping) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, mapping)
    return
  }
  if (node === null || typeof node !== 'object') return
  for (const [key, value] of Object.entries(node)) {
    if (IDENTITY_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
      node[key] = anonymizeValue(value, mapping)
    } else if (key === 'riotIdTagLine' && typeof value === 'string' && value.length > 0) {
      node[key] = 'TAG'
    } else if (key === 'KillerName' || key === 'VictimName' || key === 'Assisters') {
      // Event feed references players by name too.
      if (typeof value === 'string' && value.length > 0) {
        node[key] = anonymizeValue(value, mapping)
      } else if (Array.isArray(value)) {
        node[key] = value.map((v) => (typeof v === 'string' ? anonymizeValue(v, mapping) : v))
      }
    } else {
      walk(value, mapping)
    }
  }
}

function anonymizeDir(dir) {
  const mapping = new Map()
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  for (const file of files.sort()) {
    const path = join(dir, file)
    const data = JSON.parse(readFileSync(path, 'utf8'))
    walk(data, mapping)
    writeFileSync(path, JSON.stringify(data, null, 2))
  }
  return files.length
}

let sessions = 0
let total = 0
try {
  for (const entry of readdirSync(RECORDINGS_DIR)) {
    const dir = join(RECORDINGS_DIR, entry)
    if (!statSync(dir).isDirectory()) continue
    total += anonymizeDir(dir)
    sessions += 1
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
console.log(`Anonymized ${total} snapshot(s) across ${sessions} session(s).`)
