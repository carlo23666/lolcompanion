import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { allGameDataSchema } from '@shared/schemas/liveclient'
import { baselinePoolSchema } from '@shared/schemas/baselines'
import type { GameState, GameStateItem } from '@shared/gamestate'
import { normalizeSnapshot } from '@main/engine/normalize'
import {
  endgameRecommendation,
  loadBaselinePool,
  missingFor,
  nextBuyRecommendation,
  resolveBaseline,
  type MetaItemsInput
} from '@main/engine/nextbuy'
import { recommend } from '@main/engine/recommend'
import type { StaticData } from '@main/staticdata/manager'
import poolJson from '@main/engine/baselines/pool.json'
import { loadFixtureStaticData } from './helpers/staticdata'

let staticData: StaticData
let mid: GameState

/**
 * Stable pool for behavioral tests, decoupled from the owner's real
 * pool.json (which changes as his builds evolve). Boots → IE → Runaan → LDR.
 */
const TEST_POOL = baselinePoolSchema.parse({
  champions: [
    {
      championId: 'Jinx',
      role: 'BOTTOM',
      core: [3006, 3031, 3085, 3036],
      situational: [3026, 3139, 3153]
    }
  ]
})

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
      expect(staticData.champions.has(champion.championId), `champion ${champion.championId}`).toBe(
        true
      )
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
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL)
    // Berserker's (1st core) costs 1100 > 350 → affordable component instead.
    expect(rec?.action).toBe('add')
    const node = staticData.itemGraph.nodes.get(rec?.itemId ?? -1)
    expect(node?.totalGold).toBeLessThanOrEqual(350)
    expect(rec?.reasons.join(' ')).toContain('1º objeto')
  })

  it('can afford the full completion → prioritize', () => {
    const state = selfWith('Jinx', [], 1200)
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL)
    expect(rec?.itemId).toBe(3006)
    expect(rec?.action).toBe('prioritize')
    expect(rec?.reasons.join(' ')).toContain('disponible')
  })

  it('skips owned core items and moves to the next one', () => {
    const state = selfWith('Jinx', [3006, 3031], 2000)
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL)
    // Next core: Runaan's (3085); 2000 < 2650 → component or delay, targeting it.
    expect(rec).not.toBeNull()
    expect(rec?.reasons.join(' ')).toContain('3º objeto')
  })

  it('complete core build → null', () => {
    const state = selfWith('Jinx', [3006, 3031, 3085, 3036], 3000)
    expect(nextBuyRecommendation(state, staticData, TEST_POOL)).toBeNull()
  })

  it('champion outside the pool → null', () => {
    const state = selfWith('Teemo', [], 3000)
    expect(nextBuyRecommendation(state, staticData, TEST_POOL)).toBeNull()
  })

  it('waits when nothing useful is affordable', () => {
    const state = selfWith('Jinx', [], 100)
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL)
    expect(rec?.action).toBe('delay')
    expect(rec?.reasons.join(' ')).toContain('Guarda oro')
  })
})

describe('meta fallback baseline (Master+ items)', () => {
  // Kraken (3153-like) → use real SR items: IE 3031, Runaan 3085, LDR 3036, boots 3006, GA 3026, QSS 3139.
  const META: MetaItemsInput = {
    games: 120,
    items: [
      { itemId: 3031, games: 100, wins: 55 },
      { itemId: 3085, games: 90, wins: 50 },
      { itemId: 3006, games: 85, wins: 47 },
      { itemId: 3036, games: 60, wins: 33 },
      { itemId: 3026, games: 40, wins: 22 },
      { itemId: 3139, games: 20, wins: 11 }
    ]
  }

  it('champion outside the pool but with meta data → Master+ build advice', () => {
    const state = selfWith('Teemo', [], 1200)
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL, META)
    expect(rec).not.toBeNull()
    expect(rec?.reasons.join(' ')).toContain('Master+')
  })

  it('meta baseline wins over pool when both exist (Master+ first, 2026-07-07)', () => {
    const state = selfWith('Jinx', [], 1200)
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL, META)
    expect(rec?.reasons.join(' ')).toContain('Master+')
    expect(rec?.reasons.join(' ')).not.toContain('tu build')
  })

  it('pool is the fallback only when the meta build is unusable (<3 finished items)', () => {
    const state = selfWith('Jinx', [], 1200)
    // Two usable items → no meta build → pool carries it.
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL, {
      games: 200,
      items: META.items.slice(0, 2)
    })
    expect(rec?.reasons.join(' ')).toContain('tu build')
    expect(rec?.reasons.join(' ')).not.toContain('más comprado en Master+')
  })

  it('WP-018 never-silent: a thin-but-usable Master+ sample still builds from meta', () => {
    // Champion only played 10 times, but the core items each clear the per-item
    // floor → the build comes from Master+, not the pool (no more empty advice).
    const state = selfWith('Teemo', [], 1200)
    const baseline = resolveBaseline(state, staticData, TEST_POOL, { ...META, games: 10 })
    expect(baseline?.source).toBe('meta')
    expect(baseline?.core[0]).toBe(3031)
  })

  it('per-item sample gate: items below the floor are rejected', () => {
    const state = selfWith('Teemo', [], 1200)
    expect(
      resolveBaseline(state, staticData, TEST_POOL, {
        games: 120,
        items: META.items.map((entry) => ({ ...entry, games: 2 }))
      })
    ).toBeNull()
  })

  it('legacy meta keeps a conservative three-item inferred core', () => {
    const state = selfWith('Teemo', [], 1200)
    const withJunk: MetaItemsInput = {
      games: 120,
      items: [
        { itemId: 1038, games: 100, wins: 50 }, // component (depth 1) → out
        { itemId: 3363, games: 100, wins: 50 }, // trinket → out
        ...META.items
      ]
    }
    const baseline = resolveBaseline(state, staticData, TEST_POOL, withJunk)
    expect(baseline?.source).toBe('meta')
    expect(baseline?.core).toEqual([3031, 3085, 3006])
    expect(baseline?.situational).toEqual([3036, 3026, 3139])
  })

  it('recommend() flows the meta baseline end to end', () => {
    const state = selfWith('Teemo', [], 5000)
    const recs = recommend(state, staticData, TEST_POOL, META)
    const top = recs[0]
    expect(top?.itemId).toBe(3031)
    expect(top?.reasons.join(' ')).toContain('Master+')
  })

  it('pool champions get Master+ item WR annotations too', () => {
    // Jinx IS in TEST_POOL (own baseline wins) — but the advised item still
    // gets its Master+ winrate line when the sample is big enough.
    const state = selfWith('Jinx', [3006], 5000) // boots owned → next core: IE 3031
    const recs = recommend(state, staticData, TEST_POOL, {
      games: 500,
      items: [{ itemId: 3031, games: 400, wins: 232 }] // 58%
    })
    const top = recs[0]
    expect(top?.itemId).toBe(3031)
    expect(top?.reasons.join(' ')).toContain('tu build') // pool baseline, not meta build
    expect(top?.reasons.join(' ')).toContain('58% WR llevando este objeto')
  })

  it('thin per-item samples add no annotation', () => {
    const state = selfWith('Jinx', [3006], 5000)
    const recs = recommend(state, staticData, TEST_POOL, {
      games: 500,
      items: [{ itemId: 3031, games: 4, wins: 4 }]
    })
    expect(recs[0]?.reasons.join(' ')).not.toContain('llevando este objeto')
  })
})

describe('nextBuyRecommendation with Magical Footwear (rune 8304)', () => {
  it('skips the boots core slot while no boots are owned and explains why', () => {
    const state = selfWith('Jinx', [], 5000)
    state.self.runeIds = [8304]
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL)
    // Boots (1st core) are unpurchasable → target jumps to IE (2nd core).
    expect(rec?.itemId).toBe(3031)
    expect(rec?.reasons.join(' ')).toContain('Calzado Mágico')
  })

  it('resumes the boots slot once the rune granted them (upgrade advice)', () => {
    const state = selfWith('Jinx', [2422], 5000)
    state.self.runeIds = [8304]
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL)
    expect(rec?.itemId).toBe(3006)
    expect(rec?.reasons.join(' ')).not.toContain('Calzado Mágico')
  })

  it('without the rune, boots stay the first target', () => {
    const state = selfWith('Jinx', [], 5000)
    state.self.runeIds = []
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL)
    expect(rec?.itemId).toBe(3006)
  })
})

describe('nextBuyRecommendation with substitute boots', () => {
  it('other finished boots satisfy a boots core slot', () => {
    // Owns Mercs instead of the core Berserker's → move on to IE.
    const state = selfWith('Jinx', [3111], 5000)
    state.self.runeIds = []
    const rec = nextBuyRecommendation(state, staticData, TEST_POOL)
    expect(rec?.itemId).toBe(3031)
  })
})

describe('endgameRecommendation (core complete)', () => {
  const CORE = [3006, 3031, 3085, 3036]

  it('free slot: recommends the first unowned situational', () => {
    const state = selfWith('Jinx', CORE, 3200)
    const rec = endgameRecommendation(state, staticData, TEST_POOL)
    // 3026 (GA) costs 3200 → affordable → prioritize.
    expect(rec?.itemId).toBe(3026)
    expect(rec?.action).toBe('prioritize')
    expect(rec?.reasons.join(' ')).toContain('situacional')
  })

  it('free slot without gold: still points at the situational as next buy', () => {
    const state = selfWith('Jinx', CORE, 100)
    const rec = endgameRecommendation(state, staticData, TEST_POOL)
    expect(rec?.itemId).toBe(3026)
    expect(rec?.action).toBe('add')
  })

  it('six slots with a leftover starter: recommends selling it (replace)', () => {
    const state = selfWith('Jinx', [...CORE, 1055, 3072], 2000)
    const rec = endgameRecommendation(state, staticData, TEST_POOL)
    expect(rec?.action).toBe('replace')
    expect(rec?.itemId).toBe(3026)
    expect(rec?.reasons.join(' ')).toContain('véndelo')
  })

  it('six real slots without a starter: stays silent', () => {
    const state = selfWith('Jinx', [...CORE, 3072, 3153], 2000)
    // 3153 is situational-owned? no: TEST_POOL situational = [3026, 3139, 3153];
    // owning 3153 leaves 3026 unowned but there is no slot and no starter.
    expect(endgameRecommendation(state, staticData, TEST_POOL)).toBeNull()
  })

  it('owned situationals are excluded from the target', () => {
    const state = selfWith('Jinx', [...CORE, 3026], 9000)
    const rec = endgameRecommendation(state, staticData, TEST_POOL)
    expect(rec?.itemId).toBe(3139)
  })

  it('recommend() integration: engine is not silent once the core is done', () => {
    const state = selfWith('Jinx', [...CORE, 1055, 3072], 2000)
    const recommendations = recommend(state, staticData, TEST_POOL)
    const replace = recommendations.find((rec) => rec.action === 'replace')
    expect(replace).toBeDefined()
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
    // GA meta-backed (so anti-burst fires it) but a single item → no meta build,
    // so the Jinx pool carries the baseline and GA sits in its situationals.
    const gaMeta = { games: 100, items: [{ itemId: 3026, games: 40, wins: 22 }] }
    const recommendations = recommend(state, staticData, TEST_POOL, gaMeta)
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

describe('WP-021: route-aware, shrunk personal adaptation', () => {
  const META: MetaItemsInput = {
    games: 120,
    items: [
      { itemId: 3031, games: 100, wins: 55 },
      { itemId: 3085, games: 90, wins: 50 },
      { itemId: 3006, games: 85, wins: 47 },
      { itemId: 3036, games: 60, wins: 33 },
      { itemId: 3153, games: 50, wins: 27 }
    ],
    routes: [
      { starterId: 1055, items: [3031, 3006, 3085, 3036], games: 40, wins: 22 },
      { starterId: 1055, items: [3153, 3006, 3085, 3036], games: 20, wins: 11 }
    ]
  }

  it('never swaps core solely because an off-route personal item has high win rate', () => {
    const state = selfWith('Teemo', [], 1200)
    const personal: MetaItemsInput = {
      games: 20,
      items: [{ itemId: 3026, games: 12, wins: 11 }]
    }
    const baseline = resolveBaseline(state, staticData, TEST_POOL, META, personal)
    expect(baseline?.source).toBe('meta')
    expect(baseline?.core[0]).toBe(3031)
    expect(baseline?.core).not.toContain(3026)
  })

  it('sample-gated personal route frequency can choose another observed route', () => {
    const state = selfWith('Teemo', [], 1200)
    const personal: MetaItemsInput = {
      games: 14,
      items: [],
      routes: [{ starterId: 1055, items: [3153, 3006, 3085, 3036], games: 10, wins: 6 }]
    }
    const baseline = resolveBaseline(state, staticData, TEST_POOL, META, personal)
    expect(baseline?.core[0]).toBe(3153)
    expect(baseline?.route?.personalAdjusted).toBe(true)
  })

  it('leaves Master+ untouched below the personal-sample floor', () => {
    const state = selfWith('Teemo', [], 1200)
    const thin: MetaItemsInput = {
      games: 4,
      items: [],
      routes: [{ starterId: 1055, items: [3153, 3006, 3085], games: 4, wins: 4 }]
    }
    const baseline = resolveBaseline(state, staticData, TEST_POOL, META, thin)
    expect(baseline?.core[0]).toBe(3031)
    expect(baseline?.route?.personalAdjusted).toBe(false)
  })

  it('no Master+ data but role-aware personal routes still provide a build', () => {
    const state = selfWith('Teemo', [], 1200)
    const personal: MetaItemsInput = {
      games: 12,
      items: [],
      routes: [{ starterId: 1055, items: [3031, 3006, 3085], games: 8, wins: 5 }]
    }
    const baseline = resolveBaseline(state, staticData, TEST_POOL, undefined, personal)
    expect(baseline?.source).toBe('personal')
    expect(baseline?.core).toEqual([3031, 3006, 3085])
  })

  it('the personal route evidence reaches the end-to-end recommendation', () => {
    const state = selfWith('Teemo', [1055], 4000)
    const personal: MetaItemsInput = {
      games: 14,
      items: [],
      routes: [{ starterId: 1055, items: [3153, 3006, 3085, 3036], games: 10, wins: 6 }]
    }
    const recs = recommend(state, staticData, TEST_POOL, META, undefined, personal)
    expect(recs[0]?.itemId).toBe(3153)
    expect(recs[0]?.reasons.join(' ')).toContain('historial')
  })
})
