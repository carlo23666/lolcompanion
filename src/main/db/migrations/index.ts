/**
 * Ordered migration registry. SQL files are imported as raw strings so the
 * bundled main process is self-contained (no runtime file reads).
 * Numbered files are immutable once merged — add new ones, never edit old ones.
 */
import m001 from './001_meta.sql?raw'
import m002 from './002_match_storage.sql?raw'

export interface Migration {
  id: number
  name: string
  sql: string
}

export const migrations: Migration[] = [
  { id: 1, name: '001_meta', sql: m001 },
  { id: 2, name: '002_match_storage', sql: m002 }
]
