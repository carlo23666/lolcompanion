import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@main/db'

describe('migration runner', () => {
  it('applies migration 001 creating the meta table', () => {
    const db = new Database(':memory:')
    const applied = runMigrations(db)
    expect(applied).toBeGreaterThanOrEqual(1)
    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('hello', 'world')
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('hello') as {
      value: string
    }
    expect(row.value).toBe('world')
    db.close()
  })

  it('is idempotent: running twice applies nothing the second time', () => {
    const db = new Database(':memory:')
    const first = runMigrations(db)
    const second = runMigrations(db)
    expect(first).toBeGreaterThanOrEqual(1)
    expect(second).toBe(0)
    db.close()
  })

  it('records applied migrations in schema_migrations', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const rows = db.prepare('SELECT id, name FROM schema_migrations ORDER BY id').all() as {
      id: number
      name: string
    }[]
    expect(rows[0]).toEqual({ id: 1, name: '001_meta' })
    db.close()
  })
})
