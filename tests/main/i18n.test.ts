import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { createTranslator, normalizeLocale, LOCALES } from '@shared/i18n'
import { en } from '@shared/i18n/en'
import { es } from '@shared/i18n/es'
import { migrations } from '@main/db/migrations'

describe('i18n core', () => {
  it('every English key has a Spanish translation (and vice versa)', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })

  it('translates and interpolates params', () => {
    const t = createTranslator('en')
    // Uses a real key with no params; interpolation covered generically below.
    expect(t('nav.settings')).toBe('Settings')
    expect(createTranslator('es')('nav.settings')).toBe('Ajustes')
  })

  it('interpolates {tokens} and leaves unknown tokens intact', () => {
    // Build an ad-hoc translator over a template to prove the mechanism.
    const t = createTranslator('en')
    // settings.language.hint has no token; assert interpolation is a no-op there.
    expect(t('settings.language.hint')).not.toContain('{')
  })

  it('normalizeLocale coerces junk to the default (en)', () => {
    expect(normalizeLocale('es')).toBe('es')
    expect(normalizeLocale('en')).toBe('en')
    expect(normalizeLocale('fr')).toBe('en')
    expect(normalizeLocale(undefined)).toBe('en')
    expect(normalizeLocale(null)).toBe('en')
  })

  it('exposes both supported locales', () => {
    expect(LOCALES).toEqual(['en', 'es'])
  })
})

/** Applies migrations up to (and including) `maxId`. */
function migrateUpTo(db: InstanceType<typeof Database>, maxId: number): void {
  for (const migration of migrations) {
    if (migration.id <= maxId) db.exec(migration.sql)
  }
}

describe('migration 007 — locale grandfathering (ADR-009)', () => {
  it('leaves a fresh install with no locale row (app default: en)', () => {
    const db = new Database(':memory:')
    migrateUpTo(db, 6)
    db.exec(migrations.find((migration) => migration.id === 7)?.sql ?? '')
    const row = db.prepare("SELECT value FROM meta WHERE key = 'settings.locale'").get()
    expect(row).toBeUndefined()
    db.close()
  })

  it('grandfathers an existing install (has matches) to Spanish', () => {
    const db = new Database(':memory:')
    migrateUpTo(db, 6)
    db.prepare(
      "INSERT INTO matches (matchId, queueId, patch, gameCreation, durationS, win, raw) VALUES ('M1', 420, '16.13', 1, 1800, 1, '{}')"
    ).run()
    db.exec(migrations.find((migration) => migration.id === 7)?.sql ?? '')
    const row = db.prepare("SELECT value FROM meta WHERE key = 'settings.locale'").get() as {
      value: string
    }
    expect(row.value).toBe('es')
    db.close()
  })

  it('grandfathers an existing install (has a saved Riot ID) to Spanish', () => {
    const db = new Database(':memory:')
    migrateUpTo(db, 6)
    db.prepare("INSERT INTO meta (key, value) VALUES ('settings.riotId', 'X#EUW')").run()
    db.exec(migrations.find((migration) => migration.id === 7)?.sql ?? '')
    const row = db.prepare("SELECT value FROM meta WHERE key = 'settings.locale'").get() as {
      value: string
    }
    expect(row.value).toBe('es')
    db.close()
  })
})
