import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@main/db'
import { LiveSessionRepo } from '@main/db/repos'
import { LiveSessionPersister, findOwnChampion } from '@main/liveclient/persist'
import { allGameDataSchema, type LiveClientSnapshot } from '@shared/schemas/liveclient'

const samplePath = join(import.meta.dirname, '..', '..', 'fixtures', 'liveclientdata_sample.json')
const sample = allGameDataSchema.parse(JSON.parse(readFileSync(samplePath, 'utf8')))

function at(gameTimeS: number): LiveClientSnapshot {
  return { ...sample, gameData: { ...sample.gameData, gameTime: gameTimeS } }
}

describe('LiveSessionPersister', () => {
  it('creates one session per game and appends snapshots', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const repo = new LiveSessionRepo(db)
    const persister = new LiveSessionPersister(repo, () => new Date('2026-07-02T10:00:00Z'))

    persister.persist(at(10), at(10))
    persister.persist(at(12), at(12))
    const firstSession = persister.currentSessionId()
    expect(firstSession).not.toBeNull()
    expect(repo.snapshotCount(firstSession ?? -1)).toBe(2)

    // Game time resets → new game → new session.
    persister.persist(at(3), at(3))
    const secondSession = persister.currentSessionId()
    expect(secondSession).not.toBe(firstSession)
    expect(repo.latestSessions(10)).toHaveLength(2)
  })

  it('ends the session when the port closes', () => {
    const db = new Database(':memory:')
    runMigrations(db)
    const repo = new LiveSessionRepo(db)
    const persister = new LiveSessionPersister(repo, () => new Date('2026-07-02T10:00:00Z'))

    persister.persist(at(100), at(100))
    persister.endSession()
    expect(persister.currentSessionId()).toBeNull()
    // Next snapshot (even with larger game time) starts a fresh session.
    persister.persist(at(150), at(150))
    expect(repo.latestSessions(10)).toHaveLength(2)
  })

  it('extracts the own champion from the sample (identity used only for matching)', () => {
    expect(findOwnChampion(sample)).toBe('Annie')
  })
})
