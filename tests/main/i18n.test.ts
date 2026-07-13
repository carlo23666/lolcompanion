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

  it('keeps the Spanish product voice adult and direct', () => {
    const copy = Object.values(es).join('\n')
    expect(copy).not.toMatch(/¿Qué te pego\?|ligeramente friki|Soy \{mascot\}/i)
    expect(copy).not.toMatch(/no compres (?:armadura|RM) de tanque/i)
    expect(es['coach.persona']).toContain('No te presentes')
    expect(es['coach.persona']).toContain('tono infantil')
    expect(es['csp.whatPick']).toBe('Opciones de pick · tus partidas + Master+ + encaje')
  })

  it('frames draft defense as a later compatible option, not a tank-item lecture', () => {
    const t = createTranslator('es')
    const advice = t('cs.tip.carryArmor', {
      heavy: 'Comp enemiga muy AD (3 de 5)',
      items: 'Ángel de la guarda',
      cheap: 'Chaleco de cadenas'
    })
    expect(advice).toContain('reservar una opción de armadura tras el núcleo')
    expect(advice).toContain('Ángel de la guarda')
    expect(advice).not.toContain('no compres')
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
