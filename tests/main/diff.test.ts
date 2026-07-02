import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { allGameDataSchema } from '@shared/schemas/liveclient'
import type { GameState, GameStateEvent } from '@shared/gamestate'
import { diffGameStates } from '@main/engine/diff'
import { normalizeSnapshot } from '@main/engine/normalize'
import { loadFixtureStaticData } from './helpers/staticdata'

const sessionDir = join(import.meta.dirname, '..', '..', 'fixtures', 'liveclient', 'session')

let states: GameState[]
let allEvents: GameStateEvent[][]

beforeAll(async () => {
  const staticData = await loadFixtureStaticData()
  const files = readdirSync(sessionDir).filter((f) => f.endsWith('.json')).sort()
  expect(files.length).toBeGreaterThanOrEqual(6)
  states = files.map((file) => {
    const snapshot = allGameDataSchema.parse(
      JSON.parse(readFileSync(join(sessionDir, file), 'utf8'))
    )
    const state = normalizeSnapshot(snapshot, staticData)
    if (!state) throw new Error(`normalize returned null for ${file}`)
    return state
  })
  allEvents = []
  for (let i = 1; i < states.length; i++) {
    const prev = states[i - 1]
    const next = states[i]
    if (!prev || !next) throw new Error('missing state')
    allEvents.push(diffGameStates(prev, next))
  }
})

describe('diff engine (replayed session fixture)', () => {
  it('no events between identical consecutive snapshots', () => {
    expect(allEvents[0]).toEqual([])
  })

  it('detects Infinity Edge completion (but not component swaps)', () => {
    const events = allEvents[1] ?? []
    const completions = events.filter((e) => e.type === 'itemCompleted')
    expect(completions).toHaveLength(1)
    expect(completions[0]).toMatchObject({
      type: 'itemCompleted',
      championName: 'Jinx',
      item: { id: 3031 }
    })
  })

  it('detects Berserker completion together with the level up', () => {
    const events = allEvents[2] ?? []
    const completions = events.filter((e) => e.type === 'itemCompleted')
    expect(completions.map((e) => e.item.id)).toContain(3006)
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'levelUp', championName: 'Jinx', level: 5 })
    )
  })

  it('detects death and respawn', () => {
    expect(allEvents[3]).toContainEqual(
      expect.objectContaining({ type: 'playerDied', championName: 'Jinx' })
    )
    expect(allEvents[4]).toContainEqual(
      expect.objectContaining({ type: 'playerRespawned', championName: 'Jinx' })
    )
  })

  it('detects the dragon taken by the enemy team', () => {
    expect(allEvents[4]).toContainEqual(
      expect.objectContaining({
        type: 'objectiveTaken',
        team: 'CHAOS',
        objective: 'dragon',
        detail: 'EARTH'
      })
    )
  })

  it('is deterministic: same inputs → same events', () => {
    const prev = states[2]
    const next = states[3]
    if (!prev || !next) throw new Error('missing state')
    expect(diffGameStates(prev, next)).toEqual(diffGameStates(prev, next))
  })
})
