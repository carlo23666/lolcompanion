import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { allGameDataSchema } from '@shared/schemas/liveclient'
import { baselinePoolSchema } from '@shared/schemas/baselines'
import type { GameState, GameStateItem } from '@shared/gamestate'
import { normalizeSnapshot } from '@main/engine/normalize'
import { loadBaselinePool, missingFor, nextBuyRecommendation } from '@main/engine/nextbuy'
import { recommend } from '@main/engine/recommend'
import type { StaticData } from '@main/staticdata/manager'
import poolJson from '@main/engine/baselines/pool.json'
import { loadFixtureStaticData } from './helpers/staticdata'

let staticData: StaticData
let mid: GameState

function item(id: number): GameStateItem {
  const node = staticData.itemGraph.nodes.get(id)
  if (!node) throw new Error(`item ${String(id)} missing`)
  return {
    id,
    name: node.name,
    totalGold: node.totalGold,
    isCompleted: node.depth >= 2 && (node.buildsInto.length === 0 || node.tags.includes('Boots')),
    tags: node.tags,
    stats: node.stats
  }
}

function selfWith(championId: string, itemIds: number[], gold: number): GameState {
  const state = structuredClone(mid)
  state.self.championId = championId
  state.self.items = itemIds.map(item)
  state.self.currentGold = gold
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
  const state = normalizeSnapshot(snapshot, staticData)
  if (!state) throw new Error('normalize null')
  mid = state
})

describe('baseline pool (placeholder — ADR-006)', () => {
  it('validates against the schema', () => {
    expect(() => baselinePoolSchema.parse(poolJson)).not.toThrow()
  })

  it('every champion and item resolves in the current patch, items purchasable on SR', () => {
    const pool = loadBaselinePool()
    for (const champion of pool.champions) {
      expect(
        staticData.champions.has(champion.championId),
        `champion ${champion.championId}`
      ).toBe(true)
      for (const itemId of [...champion.core, ...champion.situational]) {
        const node = staticData.itemGraph.nodes.get(itemId)
        expect(node?.availableOnSR, `item ${String(itemId)} (${champion.championId})`).toBe(true)
      }
    }
  })
})

describe('missingFor', () => {
  it('computes the remaining recipe cost with owned components', () => {
    const owned = new Map([[1038, 1]]) // B.F. Sword
    const { missingGold } = missingFor(3031, owned, staticData)
    // IE 3500 - BF 1300 = 2200 (pickaxe + cloak + recipe)
    expect(missingGold).toBe(2200)
  })

  it('owned full item costs nothing', () => {
    const { missingGold } = missingFor(3031, new Map([[3031, 1]]), staticData)
    expect(missingGold).toBe(0)
  })
})

describe('nextBuyRecommendation', () => {
  it('empty inventory: targets the first core item at component level', () => {
    const state = selfWith('Jinx', [], 350)
    const rec = nextBuyRecommendation(state, staticData)
    // Berserker's (1st core) costs 1100 > 350 → affordable component instead.
    expect(rec?.action).toBe('add')
    const node = staticData.itemGraph.nodes.get(rec?.itemId ?? -1)
    expect(node?.totalGold).toBeLessThanOrEqual(350)
    expect(rec?.reasons.join(' ')).toContain('1º objeto')
  })

  it('can afford the full completion → prioritize', () => {
    const state = selfWith('Jinx', [], 1200)
    const rec = nextBuyRecommendation(state, staticData)
    expect(rec?.itemId).toBe(3006)
    expect(rec?.action).toBe('prioritize')
    expect(rec?.reasons.join(' ')).toContain('YA')
  })

  it('skips owned core items and moves to the next one', () => {
    const state = selfWith('Jinx', [3006, 3031], 2000)
    const rec = nextBuyRecommendation(state, staticData)
    // Next core: Runaan's (3085); 2000 < 2650 → component or delay, targeting it.
    expect(rec).not.toBeNull()
    expect(rec?.reasons.join(' ')).toContain('3º objeto')
  })

  it('complete core build → null', () => {
    const state = selfWith('Jinx', [3006, 3031, 3085, 3036], 3000)
    expect(nextBuyRecommendation(state, staticData)).toBeNull()
  })

  it('champion outside the pool → null', () => {
    const state = selfWith('Teemo', [], 3000)
    expect(nextBuyRecommendation(state, staticData)).toBeNull()
  })

  it('waits when nothing useful is affordable', () => {
    const state = selfWith('Jinx', [], 100)
    const rec = nextBuyRecommendation(state, staticData)
    expect(rec?.action).toBe('delay')
    expect(rec?.reasons.join(' ')).toContain('Guarda oro')
  })
})

describe('full build simulation per pool champion (acceptance)', () => {
  it('granting each recommended completion walks the core build in order', () => {
    const pool = loadBaselinePool()
    for (const champion of pool.champions) {
      const purchased: number[] = []
      let items: number[] = []
      for (let step = 0; step < 20 && purchased.length < champion.core.length; step++) {
        const state = selfWith(champion.championId, items, 10_000) // rich: always complete
        const rec = nextBuyRecommendation(state, staticData, pool)
        if (rec === null) break
        expect(rec.action, `${champion.championId} step ${String(step)}`).toBe('prioritize')
        if (rec.itemId === null) throw new Error('expected concrete item')
        purchased.push(rec.itemId)
        items = [...items, rec.itemId]
      }
      expect(purchased, champion.championId).toEqual(champion.core)
    }
  })
})

describe('recommend (baseline + rules merged)', () => {
  it('mid game: next buy present and rule outputs merged, ranked, explained', () => {
    const recommendations = recommend(mid, staticData)
    expect(recommendations.length).toBeGreaterThanOrEqual(2)
    for (const rec of recommendations) {
      expect(rec.reasons.length).toBeGreaterThan(0)
    }
    const scores = recommendations.map((rec) => rec.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('boosts rule items that sit in the situational slots', () => {
    // Late-style threat: make Zed fed on the mid state so anti-burst fires GA,
    // which is in Jinx situational list.
    const state = structuredClone(mid)
    const zed = state.enemies.find((enemy) => enemy.championId === 'Zed')
    if (!zed) throw new Error('Zed missing')
    zed.scores.kills = 9
    zed.scores.deaths = 2
    const recommendations = recommend(state, staticData)
    const ga = recommendations.find((rec) => rec.itemId === 3026)
    expect(ga).toBeDefined()
    expect(ga?.reasons.join(' ')).toContain('situacionales')
  })

  it('engine latency: full recommendation pass under 50ms', () => {
    const start = performance.now()
    const iterations = 20
    for (let i = 0; i < iterations; i++) {
      recommend(mid, staticData)
    }
    const perRun = (performance.now() - start) / iterations
    expect(perRun).toBeLessThan(50)
  })
})
