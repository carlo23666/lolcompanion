import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { allGameDataSchema } from '@shared/schemas/liveclient'
import type { GameState, GameStateItem } from '@shared/gamestate'
import type { BaselinePool } from '@shared/schemas/baselines'
import { normalizeSnapshot } from '@main/engine/normalize'
import { nextBuyRecommendation, resolveBaseline } from '@main/engine/nextbuy'
import { recommend } from '@main/engine/recommend'
import type { MetaItemsInput } from '@main/engine/meta-items'
import type { StaticData } from '@main/staticdata/manager'
import { loadFixtureStaticData } from './helpers/staticdata'

let staticData: StaticData
let base: GameState

const EMPTY_POOL: BaselinePool = { champions: [] }

function item(id: number): GameStateItem {
  const node = staticData.itemGraph.nodes.get(id)
  if (node === undefined) throw new Error(`missing item ${String(id)}`)
  return {
    id,
    name: node.name,
    totalGold: node.totalGold,
    isCompleted: node.depth >= 2 && (node.buildsInto.length === 0 || node.tags.includes('Boots')),
    tags: node.tags,
    stats: node.stats
  }
}

function scenario(championId: string, role: string, items: number[] = []): GameState {
  const state = structuredClone(base)
  state.self.championId = championId
  state.self.championName = championId
  state.self.position = role
  state.self.items = items.map(item)
  state.self.currentGold = 500
  return state
}

beforeAll(async () => {
  staticData = await loadFixtureStaticData()
  const snapshot = allGameDataSchema.parse(
    JSON.parse(
      readFileSync(
        join(import.meta.dirname, '..', '..', 'fixtures', 'liveclient', 'mid.json'),
        'utf8'
      )
    )
  )
  const normalized = normalizeSnapshot(snapshot, staticData)
  if (normalized === null) throw new Error('normalization failed')
  base = normalized
})

describe('WP-021 golden engine scenarios', () => {
  const ADC_ROUTES: MetaItemsInput = {
    games: 100,
    items: [
      { itemId: 3031, games: 70, wins: 38 },
      { itemId: 3006, games: 65, wins: 35 },
      { itemId: 3085, games: 55, wins: 30 },
      { itemId: 3036, games: 40, wins: 22 },
      { itemId: 3033, games: 20, wins: 11 },
      { itemId: 3026, games: 18, wins: 10 }
    ],
    routes: [{ starterId: 1055, items: [3031, 3006, 3085, 3036], games: 30, wins: 17 }]
  }

  it('recommends the observed starter before the first shop exit', () => {
    const state = scenario('Jinx', 'BOTTOM')
    state.gameTimeS = 30
    const recommendation = nextBuyRecommendation(state, staticData, EMPTY_POOL, ADC_ROUTES)
    expect(recommendation?.itemId).toBe(1055)
    expect(recommendation?.kind).toBe('route')
    expect(recommendation?.plan?.source).toBe('meta-route')
  })

  it('keeps two non-boots core spikes above ordinary reactive rules', () => {
    const state = scenario('Jinx', 'BOTTOM', [1055])
    state.gameTimeS = 600
    state.enemyAggregates.healingIndex = 5
    const recommendations = recommend(state, staticData, EMPTY_POOL, ADC_ROUTES)
    expect(recommendations[0]?.kind).toBe('route')
    expect(recommendations[0]?.plan?.protectedCoreRemaining).toBe(2)
    const antiheal = recommendations.find((entry) => entry.itemId === 3123)
    expect(antiheal?.score ?? 0).toBeLessThanOrEqual(45)
    expect(recommendations[0]?.score ?? 0).toBeGreaterThan(antiheal?.score ?? 0)
  })

  it('does not treat a behind assassin as an emergency deviation', () => {
    const state = scenario('Jinx', 'BOTTOM', [1055])
    const zed = state.enemies.find((enemy) => enemy.championId === 'Zed')
    if (zed === undefined) throw new Error('fixture has no Zed')
    zed.scores.kills = 2
    zed.scores.deaths = 7
    const recommendations = recommend(state, staticData, EMPTY_POOL, ADC_ROUTES)
    expect(recommendations.some((entry) => entry.itemId === 3026)).toBe(false)
  })

  it('never invents an unbacked carry defensive for a support', () => {
    const state = scenario('Thresh', 'UTILITY', [3865])
    state.enemyAggregates.physicalShare = 1
    state.enemyAggregates.magicShare = 0
    const supportMeta: MetaItemsInput = {
      games: 80,
      items: [
        { itemId: 3190, games: 50, wins: 26 },
        { itemId: 3109, games: 40, wins: 21 },
        { itemId: 3050, games: 30, wins: 16 }
      ],
      routes: [{ starterId: 3865, items: [3190, 3109, 3050], games: 20, wins: 11 }]
    }
    const recommendations = recommend(state, staticData, EMPTY_POOL, supportMeta)
    expect(recommendations.some((entry) => entry.itemId === 3026 || entry.itemId === 3157)).toBe(
      false
    )
    expect(recommendations[0]?.plan?.steps[0]?.itemId).toBe(3190)
  })

  it('uses team damage only to choose between two observed valid routes', () => {
    const state = scenario('Kaisa', 'BOTTOM', [1055])
    const flexibleMeta: MetaItemsInput = {
      games: 160,
      items: [
        { itemId: 3031, games: 70, wins: 38 },
        { itemId: 3085, games: 65, wins: 35 },
        { itemId: 3036, games: 55, wins: 30 },
        { itemId: 3118, games: 70, wins: 38 },
        { itemId: 3089, games: 65, wins: 35 },
        { itemId: 3135, games: 55, wins: 30 }
      ],
      routes: [
        { starterId: 1055, items: [3031, 3085, 3036], games: 30, wins: 16 },
        { starterId: 1055, items: [3118, 3089, 3135], games: 30, wins: 16 }
      ]
    }
    state.allyAggregates.magicShare = 0.9
    state.allyAggregates.physicalShare = 0.1
    expect(resolveBaseline(state, staticData, EMPTY_POOL, flexibleMeta)?.core[0]).toBe(3031)

    state.allyAggregates.magicShare = 0.1
    state.allyAggregates.physicalShare = 0.9
    expect(resolveBaseline(state, staticData, EMPTY_POOL, flexibleMeta)?.core[0]).toBe(3118)
  })
})
