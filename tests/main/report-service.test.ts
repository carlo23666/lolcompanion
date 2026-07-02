import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, type AppDatabase } from '@main/db'
import { LiveSessionRepo, MatchRepo } from '@main/db/repos'
import { ReportService } from '@main/report'
import { StatsService } from '@main/stats'
import { matchToRows } from '@main/riot/ingest'
import { matchSchema } from '@shared/schemas/riot'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'riot')
const baseMatch = matchSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, 'match.json'), 'utf8'))
)
const OWNER = 'PUUID_PLAYER_3' // Jinx in the fixture

describe('ReportService', () => {
  let db: AppDatabase
  let service: ReportService
  let sessions: LiveSessionRepo

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    const matches = new MatchRepo(db)
    const { row, participants } = matchToRows(baseMatch)
    const own = participants.find((p) => p.puuid === OWNER)
    row.win = own?.win ?? null
    matches.insertMatch(row, baseMatch, participants)
    sessions = new LiveSessionRepo(db)
    service = new ReportService(db, new StatsService(db))
  })

  it('returns null while no session is linked to a match', () => {
    sessions.createSession('2026-07-02T20:00:00Z', 'Jinx', null)
    expect(service.lastReport(OWNER)).toBeNull()
  })

  it('builds the report from the linked session with followed recommendations', () => {
    const sessionId = sessions.createSession('2026-07-02T20:00:00Z', 'Jinx', null)
    const ownItems = baseMatch.info.participants.find((p) => p.puuid === OWNER)
    const finalItem = ownItems?.item0 ?? 0
    // One recommendation the player followed (their real item0) and one not.
    sessions.appendRecommendations(sessionId, 600, [
      { itemId: finalItem, itemName: 'Seguida', action: 'add', score: 50, reasons: [] },
      { itemId: 999999, itemName: 'Ignorada', action: 'add', score: 40, reasons: [] }
    ])
    sessions.linkMatch(sessionId, {
      matchId: baseMatch.metadata.matchId,
      result: 'WIN',
      patch: '16.13'
    })

    const report = service.lastReport(OWNER)
    expect(report).not.toBeNull()
    expect(report?.champion).toBe('Jinx')
    expect(report?.csPerMin).toBeGreaterThan(0)
    expect(report?.damageSharePct).toBeGreaterThan(0)
    expect(report?.avgCsPerMin).not.toBeNull()
    const followed = report?.recommendedItems.find((item) => item.itemId === finalItem)
    const ignored = report?.recommendedItems.find((item) => item.itemId === 999999)
    expect(followed?.followed).toBe(true)
    expect(ignored?.followed).toBe(false)
  })
})
