import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, type AppDatabase } from '@main/db'
import { MatchRepo, TimelineRepo } from '@main/db/repos'
import { HistoryService } from '@main/history'
import { matchToRows } from '@main/riot/ingest'
import { matchSchema, type RiotMatch } from '@shared/schemas/riot'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'riot')
const baseMatch = matchSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, 'match.json'), 'utf8'))
)
const rawTimeline: unknown = JSON.parse(
  readFileSync(join(fixtureDir, 'timeline.json'), 'utf8')
)
const OWNER = 'PUUID_PLAYER_3' // Jinx, team 100, wins

function matchVariant(matchId: string, gameCreation: number, champion?: string): RiotMatch {
  const clone = structuredClone(baseMatch)
  clone.metadata.matchId = matchId
  clone.info.gameCreation = gameCreation
  if (champion !== undefined) {
    const owner = clone.info.participants.find((p) => p.puuid === OWNER)
    if (owner) owner.championName = champion
  }
  return clone
}

describe('HistoryService', () => {
  let db: AppDatabase
  let service: HistoryService

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    const matches = new MatchRepo(db)
    const timelines = new TimelineRepo(db)
    for (const [index, variant] of [
      matchVariant('EUW1_1', 1000, 'Jinx'),
      matchVariant('EUW1_2', 2000, 'Jinx'),
      matchVariant('EUW1_3', 3000, 'Ahri')
    ].entries()) {
      const { row, participants } = matchToRows(variant)
      const own = participants.find((p) => p.puuid === OWNER)
      row.win = own?.win ?? null
      matches.insertMatch(row, variant, participants)
      if (index === 0) {
        const timeline = structuredClone(rawTimeline) as { metadata: { matchId: string } }
        timeline.metadata.matchId = 'EUW1_1'
        timelines.insertTimeline('EUW1_1', timeline)
      }
    }
    service = new HistoryService(db)
  })

  it('lists matches newest first with computed CS/min', () => {
    const rows = service.list(OWNER)
    expect(rows.map((row) => row.matchId)).toEqual(['EUW1_3', 'EUW1_2', 'EUW1_1'])
    const jinx = rows[1]
    // Fixture: Jinx 210+8 CS over 1854s → 7.05 CS/min
    expect(jinx?.csPerMin).toBeCloseTo(((210 + 8) / 1854) * 60, 2)
    expect(jinx?.win).toBe(true)
    expect(jinx?.patch).toBe('16.13')
  })

  it('filters by champion', () => {
    expect(service.list(OWNER, 'Ahri').map((row) => row.matchId)).toEqual(['EUW1_3'])
    expect(service.champions(OWNER)).toEqual(['Ahri', 'Jinx'])
  })

  it('aggregates winrate and CS/min per champion (hand-computed)', () => {
    const aggregates = service.aggregates(OWNER)
    const jinx = aggregates.find((aggregate) => aggregate.champion === 'Jinx')
    expect(jinx?.games).toBe(2)
    expect(jinx?.winratePct).toBe(100) // fixture: team 100 always wins
    expect(jinx?.csPerMin).toBeCloseTo(((210 + 8) / 1854) * 60, 2)
    const ahri = aggregates.find((aggregate) => aggregate.champion === 'Ahri')
    expect(ahri?.games).toBe(1)
  })

  it('detail: final build and owner gold curve from the stored timeline (offline)', () => {
    const detail = service.detail(OWNER, 'EUW1_1')
    expect(detail).not.toBeNull()
    expect(detail?.champion).toBe('Jinx')
    expect(detail?.items).toEqual([3031, 3006, 1038, 3036])
    expect(detail?.goldCurve.length).toBe(31)
    // Curve is monotonically increasing in the fixture.
    const curve = detail?.goldCurve ?? []
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1] ?? 0)
    }
  })

  it('detail without timeline still returns match data', () => {
    const detail = service.detail(OWNER, 'EUW1_2')
    expect(detail?.goldCurve).toEqual([])
    expect(detail?.items.length).toBeGreaterThan(0)
  })

  it('unknown match → null', () => {
    expect(service.detail(OWNER, 'EUW1_missing')).toBeNull()
  })
})
