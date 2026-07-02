import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@main/db'
import { MatchRepo, TimelineRepo } from '@main/db/repos'
import { ingestHistory, matchToRows } from '@main/riot/ingest'
import { RiotApiError, type RiotClient, type Result } from '@main/riot/client'
import { matchSchema, timelineSchema, type RiotMatch, type RiotTimeline } from '@shared/schemas/riot'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'riot')
const baseMatch = matchSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, 'match.json'), 'utf8'))
)
const baseTimeline = timelineSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, 'timeline.json'), 'utf8'))
)

const OWNER = 'PUUID_PLAYER_3'

function matchWithId(matchId: string): RiotMatch {
  return { ...baseMatch, metadata: { ...baseMatch.metadata, matchId } }
}
function timelineWithId(matchId: string): RiotTimeline {
  return { ...baseTimeline, metadata: { ...baseTimeline.metadata, matchId } }
}

/** Structural stub for RiotClient — only the methods ingestHistory uses. */
function stubClient(ids: string[], failFor: Set<string> = new Set()): RiotClient {
  const stub = {
    matchIds: (_puuid: string, opts: { start?: number; count?: number } = {}) => {
      const start = opts.start ?? 0
      const count = opts.count ?? 100
      return Promise.resolve({ ok: true as const, value: ids.slice(start, start + count) })
    },
    match: (matchId: string): Promise<Result<RiotMatch>> =>
      Promise.resolve(
        failFor.has(matchId)
          ? { ok: false as const, error: new RiotApiError('server', 'HTTP 500', 500) }
          : { ok: true as const, value: matchWithId(matchId) }
      ),
    timeline: (matchId: string): Promise<Result<RiotTimeline>> =>
      Promise.resolve({ ok: true as const, value: timelineWithId(matchId) })
  }
  return stub as unknown as RiotClient
}

function makeDb(): { matchRepo: MatchRepo; timelineRepo: TimelineRepo } {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return { matchRepo: new MatchRepo(db), timelineRepo: new TimelineRepo(db) }
}

describe('ingestHistory', () => {
  it('stores match + timeline for every id, newest first', async () => {
    const { matchRepo, timelineRepo } = makeDb()
    const ids = ['EUW1_3', 'EUW1_2', 'EUW1_1']
    const progress = await ingestHistory({
      client: stubClient(ids),
      matchRepo,
      timelineRepo,
      puuid: OWNER
    })

    expect(progress.done).toBe(true)
    expect(progress.stored).toBe(3)
    expect(matchRepo.count()).toBe(3)
    expect(timelineRepo.matchIdsWithTimeline().size).toBe(3)
    // Owner-centric result: PLAYER_3 (Jinx, team 100) won.
    expect(matchRepo.getMatch('EUW1_2')?.win).toBe(true)
    expect(matchRepo.getParticipants('EUW1_2')).toHaveLength(10)
  })

  it('resumes without re-downloading stored matches', async () => {
    const { matchRepo, timelineRepo } = makeDb()
    const ids = ['EUW1_3', 'EUW1_2', 'EUW1_1']
    // First run stores everything.
    await ingestHistory({ client: stubClient(ids), matchRepo, timelineRepo, puuid: OWNER })

    let matchCalls = 0
    const countingClient = stubClient(ids)
    const originalMatch = countingClient.match.bind(countingClient)
    countingClient.match = ((matchId: string) => {
      matchCalls += 1
      return originalMatch(matchId)
    })

    const progress = await ingestHistory({
      client: countingClient,
      matchRepo,
      timelineRepo,
      puuid: OWNER
    })
    expect(progress.skipped).toBe(3)
    expect(matchCalls).toBe(0)
  })

  it('counts failed matches without aborting the run', async () => {
    const { matchRepo, timelineRepo } = makeDb()
    const progress = await ingestHistory({
      client: stubClient(['EUW1_3', 'EUW1_2', 'EUW1_1'], new Set(['EUW1_2'])),
      matchRepo,
      timelineRepo,
      puuid: OWNER
    })
    expect(progress.failed).toBe(1)
    expect(progress.stored).toBe(2)
    expect(progress.done).toBe(true)
  })

  it('stops at maxMatches', async () => {
    const { matchRepo, timelineRepo } = makeDb()
    const ids = Array.from({ length: 10 }, (_, i) => `EUW1_${String(10 - i)}`)
    const progress = await ingestHistory({
      client: stubClient(ids),
      matchRepo,
      timelineRepo,
      puuid: OWNER,
      maxMatches: 4
    })
    expect(progress.stored).toBe(4)
    expect(matchRepo.count()).toBe(4)
  })

  it('respects cancellation between matches', async () => {
    const { matchRepo, timelineRepo } = makeDb()
    let processed = 0
    const progress = await ingestHistory({
      client: stubClient(['EUW1_3', 'EUW1_2', 'EUW1_1']),
      matchRepo,
      timelineRepo,
      puuid: OWNER,
      onProgress: () => {
        processed += 1
      },
      isCancelled: () => processed >= 1
    })
    expect(progress.stored).toBeLessThan(3)
  })
})

describe('matchToRows', () => {
  it('maps patch, cs (lane+jungle) and items', () => {
    const { row, participants } = matchToRows(baseMatch)
    expect(row.patch).toBe('16.13')
    expect(row.queueId).toBe(420)
    expect(row.durationS).toBe(1854)
    const jinx = participants.find((p) => p.puuid === OWNER)
    expect(jinx?.champion).toBe('Jinx')
    expect(jinx?.cs).toBe(210 + 8)
    expect(jinx?.items[0]).toBe(3031)
    expect(jinx?.items[6]).toBe(3363)
  })
})
