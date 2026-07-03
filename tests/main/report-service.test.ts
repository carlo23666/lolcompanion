import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, type AppDatabase } from '@main/db'
import { LiveSessionRepo, MatchRepo } from '@main/db/repos'
import { buildReportSummary, ReportService } from '@main/report'
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
    sessions.createSession('2026-07-02T20:00:00Z', 'Jinx', null, 'CLASSIC')
    expect(service.lastReport(OWNER)).toBeNull()
  })

  it('builds the report from the linked session with followed recommendations', () => {
    const sessionId = sessions.createSession('2026-07-02T20:00:00Z', 'Jinx', null, 'CLASSIC')
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

    const result = service.lastReport(OWNER)
    expect(result?.kind).toBe('report')
    if (result?.kind !== 'report') return
    const report = result.report
    expect(report.champion).toBe('Jinx')
    expect(report.csPerMin).toBeGreaterThan(0)
    expect(report.damageSharePct).toBeGreaterThan(0)
    expect(report.avgCsPerMin).not.toBeNull()
    expect(report.avgDeaths).not.toBeNull()
    expect(report.avgVisionScore).not.toBeNull()
    expect(report.visionScore).toBeGreaterThanOrEqual(0)
    const followed = report.recommendedItems.find((item) => item.itemId === finalItem)
    const ignored = report.recommendedItems.find((item) => item.itemId === 999999)
    expect(followed?.followed).toBe(true)
    expect(ignored?.followed).toBe(false)
  })

  it('newest session in Practice Tool → unsupported, no stale fallback', () => {
    // An older, properly linked game exists…
    const linked = sessions.createSession('2026-07-02T20:00:00Z', 'Jinx', null, 'CLASSIC')
    sessions.linkMatch(linked, {
      matchId: baseMatch.metadata.matchId,
      result: 'WIN',
      patch: '16.13'
    })
    // …but the newest session is Practice Tool (never reaches match history).
    sessions.createSession('2026-07-03T10:00:00Z', 'Jinx', null, 'PRACTICETOOL')

    const result = service.lastReport(OWNER)
    expect(result).toEqual({ kind: 'unsupported', gameMode: 'PRACTICETOOL' })
  })

  it('forMatch: report for any stored match, without needing a session', () => {
    const result = service.forMatch(OWNER, baseMatch.metadata.matchId)
    expect(result?.kind).toBe('report')
    if (result?.kind !== 'report') return
    expect(result.report.champion).toBe('Jinx')
    expect(result.report.recommendedItems).toEqual([])
  })

  it('forMatch: includes recommendations when a session was linked', () => {
    const sessionId = sessions.createSession('2026-07-02T20:00:00Z', 'Jinx', null, 'CLASSIC')
    sessions.appendRecommendations(sessionId, 600, [
      { itemId: 3031, itemName: 'IE', action: 'add', score: 50, reasons: [] }
    ])
    sessions.linkMatch(sessionId, {
      matchId: baseMatch.metadata.matchId,
      result: 'WIN',
      patch: '16.13'
    })
    const result = service.forMatch(OWNER, baseMatch.metadata.matchId)
    if (result?.kind !== 'report') throw new Error('expected report')
    expect(result.report.recommendedItems.map((item) => item.itemId)).toEqual([3031])
  })

  it('forMatch: unknown match → null', () => {
    expect(service.forMatch(OWNER, 'EUW1_NOPE')).toBeNull()
  })

  it('sessions from before the gameMode column still report (NULL = matchmade)', () => {
    const sessionId = sessions.createSession('2026-07-02T20:00:00Z', 'Jinx', null, null)
    sessions.linkMatch(sessionId, {
      matchId: baseMatch.metadata.matchId,
      result: 'WIN',
      patch: '16.13'
    })
    expect(service.lastReport(OWNER)?.kind).toBe('report')
  })
})

describe('buildReportSummary', () => {
  const base = {
    champion: 'Jinx',
    deaths: 5,
    avgDeaths: 5,
    visionScore: 20,
    avgVisionScore: 20,
    csPerMin: 7,
    avgCsPerMin: 7,
    damageSharePct: 25,
    avgDamageSharePct: 25,
    recommendedItems: []
  }

  it('quiet game near the averages produces no noise', () => {
    expect(buildReportSummary(base)).toEqual([])
  })

  it('flags dying well above the personal average', () => {
    const lines = buildReportSummary({ ...base, deaths: 9 })
    expect(lines.some((line) => line.includes('muerto 9'))).toBe(true)
  })

  it('praises low deaths', () => {
    const lines = buildReportSummary({ ...base, deaths: 2 })
    expect(lines.some((line) => line.includes('control del riesgo'))).toBe(true)
  })

  it('flags low vision score', () => {
    const lines = buildReportSummary({ ...base, visionScore: 10 })
    expect(lines.some((line) => line.includes('Visión baja'))).toBe(true)
  })

  it('flags low farm vs the personal average', () => {
    const lines = buildReportSummary({ ...base, csPerMin: 5 })
    expect(lines.some((line) => line.includes('CS/min'))).toBe(true)
  })

  it('summarizes recommendation adherence when there were enough of them', () => {
    const items = [true, true, true, false].map((followed, index) => ({
      itemId: index,
      itemName: null,
      followed
    }))
    const lines = buildReportSummary({ ...base, recommendedItems: items })
    expect(lines.some((line) => line.includes('3 de 4'))).toBe(true)
  })

  it('caps at four lines', () => {
    const lines = buildReportSummary({
      ...base,
      deaths: 12,
      visionScore: 5,
      csPerMin: 3,
      damageSharePct: 40,
      recommendedItems: [
        { itemId: 1, itemName: null, followed: false },
        { itemId: 2, itemName: null, followed: false },
        { itemId: 3, itemName: null, followed: false }
      ]
    })
    expect(lines.length).toBeLessThanOrEqual(4)
  })
})
