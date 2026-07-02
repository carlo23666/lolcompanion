import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { allGameDataSchema, type LiveClientSnapshot } from '@shared/schemas/liveclient'
import type { GameState } from '@shared/gamestate'
import { estimateGoldEarned, normalizeSnapshot, playerDamageSplit } from '@main/engine/normalize'
import type { StaticData } from '@main/staticdata/manager'
import { loadFixtureStaticData } from './helpers/staticdata'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'liveclient')
const loadSnapshot = (name: string): LiveClientSnapshot =>
  allGameDataSchema.parse(JSON.parse(readFileSync(join(fixtureDir, `${name}.json`), 'utf8')))

let staticData: StaticData
let early: GameState
let mid: GameState
let late: GameState

beforeAll(async () => {
  staticData = await loadFixtureStaticData()
  const normalize = (name: string): GameState => {
    const state = normalizeSnapshot(loadSnapshot(name), staticData)
    if (!state) throw new Error(`normalize returned null for ${name}`)
    return state
  }
  early = normalize('early')
  mid = normalize('mid')
  late = normalize('late')
})

describe('normalizeSnapshot (early/mid/late fixtures)', () => {
  it('resolves self (exact gold/stats) and splits teams 4/5', () => {
    expect(mid.self.championId).toBe('Jinx')
    expect(mid.self.currentGold).toBe(1250)
    expect(mid.self.team).toBe('ORDER')
    expect(mid.allies).toHaveLength(4)
    expect(mid.enemies).toHaveLength(5)
    expect(mid.patch).toBe('16.13.1')
  })

  it('resolves items against the item graph (IE completed, wards not)', () => {
    const ie = mid.self.items.find((item) => item.id === 3031)
    expect(ie).toBeDefined()
    expect(ie?.isCompleted).toBe(true)
    expect(ie?.totalGold).toBe(3500)
    const ward = mid.self.items.find((item) => item.id === 3340)
    expect(ward?.isCompleted).toBe(false)
  })

  it('GOLD MODEL: hand-computed estimate for self at mid game', () => {
    // Jinx mid: t=900s, cs=150, kills=4, assists=3
    // 500 + 2.04*(900-110) + 150*21 + 4*300 + 3*150 = 6911.6
    expect(mid.self.estimatedGoldEarned).toBeCloseTo(6911.6, 1)
    expect(estimateGoldEarned(900, { kills: 4, assists: 3, creepScore: 150 })).toBeCloseTo(
      6911.6,
      1
    )
  })

  it('gold model: no passive income before 1:50', () => {
    expect(estimateGoldEarned(60, { kills: 0, assists: 0, creepScore: 10 })).toBeCloseTo(
      500 + 210,
      6
    )
  })

  it('enemy team (4 AD champs + Soraka) reads heavily physical', () => {
    expect(mid.enemyAggregates.physicalShare).toBeGreaterThan(0.65)
    expect(mid.enemyAggregates.magicShare).toBeLessThan(0.35)
    expect(mid.enemyAggregates.physicalShare + mid.enemyAggregates.magicShare).toBeCloseTo(1, 6)
  })

  it('healing index counts Aatrox + Soraka + lifesteal items', () => {
    // Aatrox (2) + Soraka (2) = 4, plus BotRK lifesteal on Lee Sin (+0.5)
    expect(mid.enemyAggregates.healingIndex).toBeGreaterThanOrEqual(4)
  })

  it('tankiness grows early → mid → late', () => {
    expect(mid.enemyAggregates.tankinessIndex).toBeGreaterThan(
      early.enemyAggregates.tankinessIndex
    )
    expect(late.enemyAggregates.tankinessIndex).toBeGreaterThan(
      mid.enemyAggregates.tankinessIndex
    )
  })

  it('objectives: dragons by subtype, towers by destroyed enemy turrets', () => {
    expect(mid.objectives.dragons.ORDER).toEqual(['FIRE'])
    expect(mid.objectives.heralds.CHAOS).toBe(1)
    expect(mid.objectives.towers.ORDER).toBe(1) // Turret_T2 destroyed by ORDER

    expect(late.objectives.dragons.ORDER).toEqual(['FIRE', 'HEXTECH'])
    expect(late.objectives.dragons.CHAOS).toEqual(['OCEAN'])
    expect(late.objectives.barons.ORDER).toBe(1)
    expect(late.objectives.towers.CHAOS).toBe(1) // Turret_T1 destroyed by CHAOS
  })

  it('returns null when the active player is not in allPlayers', () => {
    const snapshot = loadSnapshot('mid')
    const broken = {
      ...snapshot,
      activePlayer: { ...snapshot.activePlayer, riotId: 'GHOST#TAG', summonerName: 'GHOST' }
    }
    expect(normalizeSnapshot(broken, staticData)).toBeNull()
  })
})

describe('playerDamageSplit', () => {
  it('pure profile when no damage items', () => {
    expect(playerDamageSplit('physical', [])).toEqual([0.85, 0.15])
    expect(playerDamageSplit('magic', [])[1]).toBeCloseTo(0.85, 6)
    expect(playerDamageSplit('mixed', [])).toEqual([0.5, 0.5])
  })

  it('item investment shifts the split', () => {
    const apItem = {
      id: 1,
      name: 'x',
      totalGold: 0,
      isCompleted: true,
      tags: [],
      stats: { FlatMagicDamageMod: 100 }
    }
    // mixed champion full AP: 0.6*0.5 + 0.4*0 = 0.30 physical
    const [phys] = playerDamageSplit('mixed', [apItem])
    expect(phys).toBeCloseTo(0.3, 6)
  })
})
