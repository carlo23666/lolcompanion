import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, type AppDatabase } from '@main/db'
import { LiveSessionRepo, MatchRepo, TimelineRepo } from '@main/db/repos'
import { catchUpMissedMatches, PostGameIngestor } from '@main/postgame'
import type { RiotClient } from '@main/riot/client'
import { matchSchema, timelineSchema, type RiotMatch, type RiotTimeline } from '@shared/schemas/riot'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'riot')
const baseMatch = matchSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, 'match.json'), 'utf8'))
)
const baseTimeline = timelineSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, 'timeline.json'), 'utf8'))
)
const OWNER = 'PUUID_PLAYER_3'
const MATCH_ID = 'EUW1_7000000001'

function stubClient(options: { publishedAfterAttempt?: number } = {}): {
  client: RiotClient
  calls: { ids: number }
} {
  const calls = { ids: 0 }
  const publishedAfter = options.publishedAfterAttempt ?? 0
  const client = {
    matchIds: () => {
      calls.ids += 1
      return Promise.resolve({
        ok: true as const,
        value: calls.ids > publishedAfter ? [MATCH_ID] : []
      })
    },
    match: (): Promise<{ ok: true; value: RiotMatch }> =>
      Promise.resolve({ ok: true as const, value: baseMatch }),
    timeline: (): Promise<{ ok: true; value: RiotTimeline }> =>
      Promise.resolve({ ok: true as const, value: baseTimeline })
  }
  return { client: client as unknown as RiotClient, calls }
}

describe('PostGameIngestor', () => {
  let db: AppDatabase
  let sessions: LiveSessionRepo

  beforeEach(() => {
    vi.useFakeTimers()
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    sessions = new LiveSessionRepo(db)
  })
  afterEach(() => {
    vi.useRealTimers()
    db.close()
  })

  it('fetches, stores and links the finished match to the live session', async () => {
    const sessionId = sessions.createSession('2026-07-02T10:00:00Z', 'Jinx', null)
    const { client } = stubClient()
    const stored: string[] = []
    const ingestor = new PostGameIngestor({
      db,
      getContext: () => ({ client, puuid: OWNER }),
      onStored: (matchId) => stored.push(matchId),
      attemptDelaysMs: [1000, 1000, 1000]
    })

    ingestor.onPhase('postGame')
    await vi.advanceTimersByTimeAsync(1100)

    expect(stored).toEqual([MATCH_ID])
    expect(new MatchRepo(db).hasMatch(MATCH_ID)).toBe(true)
    expect(new TimelineRepo(db).hasTimeline(MATCH_ID)).toBe(true)
    const session = sessions.getSession(sessionId)
    expect(session?.matchId).toBe(MATCH_ID)
    expect(session?.result).toBe('WIN') // PLAYER_3 (Jinx, team 100) won
    expect(session?.patch).toBe('16.13')
  })

  it('retries until Riot publishes the match', async () => {
    sessions.createSession('2026-07-02T10:00:00Z', 'Jinx', null)
    const { client, calls } = stubClient({ publishedAfterAttempt: 2 })
    const ingestor = new PostGameIngestor({
      db,
      getContext: () => ({ client, puuid: OWNER }),
      attemptDelaysMs: [1000, 1000, 1000, 1000]
    })

    ingestor.onPhase('postGame')
    await vi.advanceTimersByTimeAsync(5000)

    expect(calls.ids).toBe(3)
    expect(new MatchRepo(db).hasMatch(MATCH_ID)).toBe(true)
  })

  it('gives up after exhausting the retry schedule', async () => {
    const { client, calls } = stubClient({ publishedAfterAttempt: 99 })
    const logs: string[] = []
    const ingestor = new PostGameIngestor({
      db,
      getContext: () => ({ client, puuid: OWNER }),
      attemptDelaysMs: [1000, 1000],
      log: (message) => logs.push(message)
    })

    ingestor.onPhase('postGame')
    await vi.advanceTimersByTimeAsync(10_000)

    expect(calls.ids).toBe(2)
    expect(logs.join(' ')).toContain('giving up')
  })

  it('links the session even when the match was already stored by a sync', async () => {
    const sessionId = sessions.createSession('2026-07-02T10:00:00Z', 'Jinx', null)
    const { client } = stubClient()
    // Pre-store via a plain insert (as the WP-004 sync would).
    const matchRepo = new MatchRepo(db)
    matchRepo.insertMatch(
      {
        matchId: MATCH_ID,
        queueId: 420,
        patch: '16.13',
        gameCreation: 1,
        durationS: 1854,
        win: true
      },
      baseMatch,
      []
    )
    const ingestor = new PostGameIngestor({
      db,
      getContext: () => ({ client, puuid: OWNER }),
      attemptDelaysMs: [1000]
    })
    ingestor.onPhase('postGame')
    await vi.advanceTimersByTimeAsync(1100)

    expect(sessions.getSession(sessionId)?.matchId).toBe(MATCH_ID)
  })

  it('does nothing without API context (no key / no puuid)', async () => {
    const ingestor = new PostGameIngestor({
      db,
      getContext: () => null,
      attemptDelaysMs: [1000, 1000]
    })
    ingestor.onPhase('postGame')
    await vi.advanceTimersByTimeAsync(5000)
    expect(new MatchRepo(db).count()).toBe(0)
  })

  it('a new game cancels the pending fetch', async () => {
    const { client, calls } = stubClient()
    const ingestor = new PostGameIngestor({
      db,
      getContext: () => ({ client, puuid: OWNER }),
      attemptDelaysMs: [1000]
    })
    ingestor.onPhase('postGame')
    ingestor.onPhase('inGame')
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls.ids).toBe(0)
  })
})

describe('catchUpMissedMatches', () => {
  let db: AppDatabase

  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  })
  afterEach(() => db.close())

  function catchUpClient(ids: string[]): { client: RiotClient; fetched: string[] } {
    const fetched: string[] = []
    const client = {
      matchIds: () => Promise.resolve({ ok: true as const, value: ids }),
      match: (matchId: string): Promise<{ ok: true; value: RiotMatch }> => {
        fetched.push(matchId)
        return Promise.resolve({
          ok: true as const,
          value: {
            ...baseMatch,
            metadata: { ...baseMatch.metadata, matchId }
          }
        })
      },
      timeline: (): Promise<{ ok: true; value: RiotTimeline }> =>
        Promise.resolve({ ok: true as const, value: baseTimeline })
    }
    return { client: client as unknown as RiotClient, fetched }
  }

  it('ingests only the matches missing from the DB', async () => {
    const missedId = 'EUW1_7000000099'
    const { client, fetched } = catchUpClient([missedId, baseMatch.metadata.matchId])

    const first = await catchUpMissedMatches({
      db,
      getContext: () => ({ client, puuid: OWNER })
    })
    expect(first.sort()).toEqual([baseMatch.metadata.matchId, missedId].sort())
    expect(new MatchRepo(db).hasMatch(missedId)).toBe(true)
    expect(new TimelineRepo(db).hasTimeline(missedId)).toBe(true)

    // Second run: everything already stored → nothing fetched or ingested.
    fetched.length = 0
    const second = await catchUpMissedMatches({
      db,
      getContext: () => ({ client, puuid: OWNER })
    })
    expect(second).toEqual([])
    expect(fetched).toEqual([])
  })

  it('is a silent no-op without API context', async () => {
    const stored = await catchUpMissedMatches({ db, getContext: () => null })
    expect(stored).toEqual([])
    expect(new MatchRepo(db).count()).toBe(0)
  })
})
