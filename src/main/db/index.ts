import Database from 'better-sqlite3'
import { migrations } from './migrations'

export type AppDatabase = Database.Database

/**
 * Opens (or creates) the SQLite database at `path` and applies pending
 * migrations. Idempotent: applied migrations are tracked in `schema_migrations`
 * and skipped on subsequent runs.
 */
export function openDatabase(path: string): AppDatabase {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

export function runMigrations(db: AppDatabase): number {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id INTEGER PRIMARY KEY,
       name TEXT NOT NULL,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     ) STRICT`
  )
  const appliedIds = new Set(
    db
      .prepare('SELECT id FROM schema_migrations')
      .all()
      .map((row) => (row as { id: number }).id)
  )
  let applied = 0
  const insert = db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)')
  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue
    db.transaction(() => {
      db.exec(migration.sql)
      insert.run(migration.id, migration.name)
    })()
    applied += 1
  }
  return applied
}
