import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, type AppDatabase } from '@main/db'
import { MatchRepo, TimelineRepo } from '@main/db/repos'
import { StatsService } from '@main/stats'
import { matchToRows } from '@main/riot/ingest'
import { matchSchema, type RiotMatch } from '@shared/schemas/riot'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'riot')
const baseMatch = matchSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, 'match.json'), 'utf8'))
)
const rawTimeline: unknown = JSON.parse(readFileSync(join(fixtureDir, 'timeline.json'), 'utf8'))
const OWNER = 'PUUID_PLAYER_3' // Jinx, team 100, wins in the fixture

const HOUR = 60 * 60 * 1000

interface Variant {
  matchId: string
  gameCreation: number
  ownWins: boolean
  durationS?: number
  withTimeline?: boolean
}

function makeMatch(variant: Variant): RiotMatch {
  const clone = structuredClone(baseMatch)
  clone.metadata.matchId = variant.matchId
  clone.info.gameCreation = variant.gameCreation
  if (variant.durationS !== undefined) clone.info.gameDuration = variant.durationS
  if (!variant.ownWins) {
    // Flip every participant's win flag so the owner's team loses.
    for (const participant of clone.info.participants) participant.win = !participant.win
  }
  return clone
}

function seed(db: AppDatabase, variants: Variant[]): void {
  const matches = new MatchRepo(db)
  const timelines = new TimelineRepo(db)
  for (const variant of variants) {
    const match = makeMatch(variant)
    const { row, participants } = matchToRows(match)
    const own = participants.find((p) => p.puuid === OWNER)
    row.win = own?.win ?? null
    matches.insertMatch(row, match, participants)
    if (variant.withTimeline === true) {
      const timeline = structuredClone(rawTimeline) as { metadata: { matchId: string } }
      timeline.metadata.matchId = variant.matchId
      timelines.insertTimeline(variant.matchId, timeline)
    }
  }
}

describe('StatsService', () => {
  let db: AppDatabase
  let service: StatsService

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    service = new StatsService(db)
  })

  it('computes streaks and session-position winrates (hand-computed)', () => {
    // One session: W W L L L (5 games 10 min apart) → current -3, longestWin 2.
    seed(db, [
      { matchId: 'M1', gameCreation: 0, ownWins: true },
      { matchId: 'M2', gameCreation: 10 * 60 * 1000, ownWins: true },
      { matchId: 'M3', gameCreation: 20 * 60 * 1000, ownWins: false },
      { matchId: 'M4', gameCreation: 30 * 60 * 1000, ownWins: false },
      { matchId: 'M5', gameCreation: 40 * 60 * 1000, ownWins: false }
    ])
    const { streaks } = service.overview(OWNER)
    expect(streaks.current).toBe(-3)
    expect(streaks.longestWin).toBe(2)
    expect(streaks.longestLoss).toBe(3)
    // Games 1-2 of the session: W W → 100%. Games 3+: L L L → 0%.
    expect(streaks.sessionFirstWrPct).toBe(100)
    expect(streaks.sessionLaterWrPct).toBe(0)
    expect(streaks.sessionLaterGames).toBe(3)
  })

  it('separates sessions on a 45+ minute gap', () => {
    // Two sessions of 2 games each → all four are "games 1-2".
    seed(db, [
      { matchId: 'M1', gameCreation: 0, ownWins: true },
      { matchId: 'M2', gameCreation: 10 * 60 * 1000, ownWins: false },
      { matchId: 'M3', gameCreation: 3 * HOUR, ownWins: true },
      { matchId: 'M4', gameCreation: 3 * HOUR + 10 * 60 * 1000, ownWins: false }
    ])
    const { streaks } = service.overview(OWNER)
    expect(streaks.sessionFirstWrPct).toBe(50)
    expect(streaks.sessionLaterWrPct).toBeNull()
  })

  it('buckets winrate by duration', () => {
    seed(db, [
      { matchId: 'M1', gameCreation: 0, ownWins: true, durationS: 20 * 60 },
      { matchId: 'M2', gameCreation: HOUR * 3, ownWins: false, durationS: 28 * 60 },
      { matchId: 'M3', gameCreation: HOUR * 6, ownWins: true, durationS: 40 * 60 }
    ])
    const { durations } = service.overview(OWNER)
    expect(durations).toEqual([
      { bucket: 'corta', games: 1, winratePct: 100 },
      { bucket: 'media', games: 1, winratePct: 0 },
      { bucket: 'larga', games: 1, winratePct: 100 }
    ])
  })

  it('champion stats include damage share vs own team', () => {
    seed(db, [{ matchId: 'M1', gameCreation: 0, ownWins: true }])
    const { champions } = service.overview(OWNER)
    const jinx = champions.find((stat) => stat.champion === 'Jinx')
    expect(jinx?.games).toBe(1)
    // Sanity: a share, not a raw number.
    expect(jinx?.damageSharePct).toBeGreaterThan(0)
    expect(jinx?.damageSharePct).toBeLessThan(100)
  })

  it('lane matchups aggregate the same-role enemy', () => {
    seed(db, [
      { matchId: 'M1', gameCreation: 0, ownWins: true },
      { matchId: 'M2', gameCreation: HOUR * 3, ownWins: false }
    ])
    const { worstMatchups, bestMatchups } = service.overview(OWNER)
    // Fixture: same enemy comp both games → owner's lane rival appears twice, 50% WR.
    const all = [...worstMatchups, ...bestMatchups]
    expect(all.length).toBeGreaterThan(0)
    expect(all[0]?.games).toBe(2)
    expect(all[0]?.winratePct).toBe(50)
  })

  it('first dragon splits winrate by which team took it', () => {
    seed(db, [{ matchId: 'M1', gameCreation: 0, ownWins: true, withTimeline: true }])
    const { firstDragon } = service.overview(OWNER)
    // The fixture timeline has a dragon kill; the match must land in one bucket.
    expect(firstDragon).not.toBeNull()
    expect((firstDragon?.withGames ?? 0) + (firstDragon?.withoutGames ?? 0)).toBe(1)
  })

  it('personal curve averages CS and gold at minutes 10/15 (needs ≥2 games)', () => {
    seed(db, [
      { matchId: 'M1', gameCreation: 0, ownWins: true, withTimeline: true },
      { matchId: 'M2', gameCreation: HOUR * 3, ownWins: true, withTimeline: true }
    ])
    const curve = service.curve(OWNER, 'Jinx')
    expect(curve).not.toBeNull()
    expect(curve?.games).toBe(2)
    expect(curve?.csAt10).toBeGreaterThan(0)
    expect(curve?.goldAt15 ?? 0).toBeGreaterThan(curve?.goldAt10 ?? 0)
    // One game only → not enough data.
    const single = new StatsService(db)
    expect(single.curve(OWNER, 'Ahri')).toBeNull()
  })

  it('overview cache self-invalidates when a new match lands', () => {
    seed(db, [{ matchId: 'M1', gameCreation: 0, ownWins: true }])
    expect(service.overview(OWNER).totalGames).toBe(1)
    seed(db, [{ matchId: 'M2', gameCreation: HOUR, ownWins: false }])
    expect(service.overview(OWNER).totalGames).toBe(2)
  })
})
