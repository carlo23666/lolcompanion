import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, type AppDatabase } from '@main/db'
import { LiveSessionRepo, MatchRepo, TimelineRepo, type MatchRow, type ParticipantRow } from '@main/db/repos'

const samplePath = join(import.meta.dirname, '..', '..', 'fixtures', 'liveclientdata_sample.json')
const liveSample: unknown = JSON.parse(readFileSync(samplePath, 'utf8'))

// Realistic minimal match-v5 shape; a full recorded fixture lands with WP-004.
const rawMatch = {
  metadata: { matchId: 'EUW1_1234567890', participants: ['puuid-1', 'puuid-2'] },
  info: { queueId: 420, gameVersion: '16.13.688.1290', gameDuration: 1854 }
}

const matchRow: MatchRow = {
  matchId: 'EUW1_1234567890',
  queueId: 420,
  patch: '16.13',
  gameCreation: 1_751_450_000_000,
  durationS: 1854,
  win: true
}

const participant = (puuid: string, champion: string): ParticipantRow => ({
  matchId: matchRow.matchId,
  puuid,
  champion,
  role: 'MIDDLE',
  win: true,
  kills: 7,
  deaths: 2,
  assists: 9,
  cs: 201,
  gold: 13250,
  damage: 24100,
  vision: 18,
  items: [3031, 3006, 1038, 0, 0, 0, 3363]
})

describe('MatchRepo', () => {
  let db: AppDatabase
  let repo: MatchRepo
  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    repo = new MatchRepo(db)
  })

  it('round-trips a match with participants', () => {
    const inserted = repo.insertMatch(matchRow, rawMatch, [
      participant('puuid-1', 'Ahri'),
      participant('puuid-2', 'Zed')
    ])
    expect(inserted).toBe(true)
    expect(repo.getMatch(matchRow.matchId)).toEqual(matchRow)
    expect(repo.getMatchRaw(matchRow.matchId)).toEqual(rawMatch)
    const participants = repo.getParticipants(matchRow.matchId)
    expect(participants).toHaveLength(2)
    expect(participants[0]?.items).toEqual([3031, 3006, 1038, 0, 0, 0, 3363])
  })

  it('is idempotent: same match twice → one row', () => {
    expect(repo.insertMatch(matchRow, rawMatch, [participant('puuid-1', 'Ahri')])).toBe(true)
    expect(repo.insertMatch(matchRow, rawMatch, [participant('puuid-1', 'Ahri')])).toBe(false)
    expect(repo.count()).toBe(1)
    expect(repo.getParticipants(matchRow.matchId)).toHaveLength(1)
  })

  it('queries by champion and by recency', () => {
    repo.insertMatch(matchRow, rawMatch, [participant('puuid-1', 'Ahri')])
    const second: MatchRow = {
      ...matchRow,
      matchId: 'EUW1_222',
      gameCreation: matchRow.gameCreation + 1000
    }
    repo.insertMatch(second, rawMatch, [{ ...participant('puuid-1', 'Zed'), matchId: 'EUW1_222' }])

    expect(repo.latestMatches(10).map((m) => m.matchId)).toEqual(['EUW1_222', matchRow.matchId])
    expect(repo.getMatchesByChampion('Ahri', 'puuid-1').map((m) => m.matchId)).toEqual([
      matchRow.matchId
    ])
    expect(repo.matchIds()).toEqual(new Set([matchRow.matchId, 'EUW1_222']))
  })
})

describe('TimelineRepo', () => {
  it('round-trips and stays idempotent', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    const matches = new MatchRepo(db)
    const repo = new TimelineRepo(db)
    matches.insertMatch(matchRow, rawMatch, [])

    const rawTimeline = { metadata: { matchId: matchRow.matchId }, info: { frames: [{}] } }
    expect(repo.insertTimeline(matchRow.matchId, rawTimeline)).toBe(true)
    expect(repo.insertTimeline(matchRow.matchId, rawTimeline)).toBe(false)
    expect(repo.hasTimeline(matchRow.matchId)).toBe(true)
    expect(repo.getTimelineRaw(matchRow.matchId)).toEqual(rawTimeline)
    expect(repo.matchIdsWithTimeline()).toEqual(new Set([matchRow.matchId]))
  })
})

describe('LiveSessionRepo', () => {
  let db: AppDatabase
  let repo: LiveSessionRepo
  beforeEach(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    repo = new LiveSessionRepo(db)
  })

  it('round-trips sessions and gzip-compressed snapshots', () => {
    const id = repo.createSession('2026-07-02T10:00:00Z', 'Annie', null)
    repo.appendSnapshot(id, 12.5, liveSample)
    repo.appendSnapshot(id, 14.5, liveSample)

    const session = repo.getSession(id)
    expect(session?.championName).toBe('Annie')
    expect(session?.result).toBeNull()

    const snapshots = repo.getSnapshots(id)
    expect(snapshots).toHaveLength(2)
    expect(snapshots[0]?.gameTimeS).toBe(12.5)
    // Normalize through JSON: the sample contains -0.00, which stringifies to 0.
    expect(snapshots[0]?.raw).toEqual(JSON.parse(JSON.stringify(liveSample)))
  })

  it('links result and match id', () => {
    const id = repo.createSession('2026-07-02T10:00:00Z', 'Annie', null)
    repo.setResult(id, 'WIN', null)
    expect(repo.getSession(id)?.result).toBe('WIN')
    expect(repo.latestUnlinkedSession()?.id).toBe(id)
  })

  it('keeps one recorded game under 20MB (900 snapshots at 2s cadence)', () => {
    const id = repo.createSession('2026-07-02T10:00:00Z', 'Annie', null)
    // Pad the sample to a realistic 10-player payload size (~35KB raw).
    const padded = {
      ...(liveSample as Record<string, unknown>),
      _padding: 'x'.repeat(28_000)
    }
    for (let i = 0; i < 900; i++) {
      repo.appendSnapshot(id, i * 2, padded)
    }
    expect(repo.snapshotCount(id)).toBe(900)
    const pageCount = db.pragma('page_count', { simple: true }) as number
    const pageSize = db.pragma('page_size', { simple: true }) as number
    const sizeMB = (pageCount * pageSize) / (1024 * 1024)
    expect(sizeMB).toBeLessThan(20)
  })
})
