import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { allGameDataSchema } from '@shared/schemas/liveclient'
import type { GameState, GameStateItem } from '@shared/gamestate'
import type { Recommendation } from '@shared/recommendation'
import type { BaselinePool } from '@shared/schemas/baselines'
import { normalizeSnapshot } from '@main/engine/normalize'
import { applyExclusivity } from '@main/engine/exclusivity'
import { endgameRecommendation, nextBuyRecommendation } from '@main/engine/nextbuy'
import { recommend } from '@main/engine/recommend'
import { itemConflict } from '@main/staticdata/itemgraph'
import type { StaticData } from '@main/staticdata/manager'
import { loadFixtureStaticData } from './helpers/staticdata'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'liveclient')

// Fixture-patch item ids used across the suite.
const MAW = 3156
const HEXDRINKER = 3155
const SHIELDBOW = 6673
const STERAK = 3053
const TRINITY = 3078
const ESSENCE_REAPER = 3508
const SHEEN = 3057
const RAVENOUS_HYDRA = 3074
const TITANIC_HYDRA = 3748
const TIAMAT = 3077
const OBLIVION_ORB = 3916
const MORELLO = 3165
const BRAMBLE = 3076
const THORNMAIL = 3075
const GUARDIAN_ANGEL = 3026
const ZHONYA = 3157
const DORANS_RING = 1056
const TEAR = 3070
const BOOTS = 1001
const STEELCAPS = 3047
const SWIFTIES = 3009
const BANSHEE = 3102
const EDGE_OF_NIGHT = 3814

let staticData: StaticData
let mid: GameState
let late: GameState

function makeItem(id: number, sd: StaticData): GameStateItem {
  const node = sd.itemGraph.nodes.get(id)
  if (!node) throw new Error(`item ${String(id)} missing`)
  return {
    id,
    name: node.name,
    totalGold: node.totalGold,
    isCompleted: node.buildsInto.length === 0 && node.depth >= 2,
    tags: node.tags,
    stats: node.stats
  }
}

function makeRec(id: number, score: number, sd: StaticData): Recommendation {
  const node = sd.itemGraph.nodes.get(id)
  if (!node) throw new Error(`item ${String(id)} missing`)
  return {
    itemId: id,
    itemName: node.name,
    category: null,
    action: 'add',
    score,
    reasons: ['razón de prueba']
  }
}

beforeAll(async () => {
  staticData = await loadFixtureStaticData()
  const load = (name: string): GameState => {
    const snapshot = allGameDataSchema.parse(
      JSON.parse(readFileSync(join(fixtureDir, `${name}.json`), 'utf8'))
    )
    const state = normalizeSnapshot(snapshot, staticData)
    if (!state) throw new Error(`normalize null for ${name}`)
    return state
  }
  mid = load('mid')
  late = load('late')
})

describe('itemConflict (passive-derived exclusivity groups)', () => {
  it('flags the Lifeline pair Maw + Shieldbow, symmetrically', () => {
    expect(itemConflict(staticData.itemGraph, MAW, SHIELDBOW)).toBe('Salvavidas')
    expect(itemConflict(staticData.itemGraph, SHIELDBOW, MAW)).toBe('Salvavidas')
  })

  it('flags the Spellblade pair Trinity + Essence Reaper', () => {
    expect(itemConflict(staticData.itemGraph, TRINITY, ESSENCE_REAPER)).toBe('Hoja encantada')
  })

  it('flags cross-tier Lifeline: Hexdrinker + Sterak', () => {
    expect(itemConflict(staticData.itemGraph, HEXDRINKER, STERAK)).toBe('Salvavidas')
  })

  it('flags two Hydras but not Tiamat with its own upgrade', () => {
    expect(itemConflict(staticData.itemGraph, RAVENOUS_HYDRA, TITANIC_HYDRA)).toBe('Hender')
    expect(itemConflict(staticData.itemGraph, TIAMAT, TITANIC_HYDRA)).toBeNull()
  })

  it('flags two finished boots as Botas but not basic boots with an upgrade', () => {
    expect(itemConflict(staticData.itemGraph, STEELCAPS, SWIFTIES)).toBe('Botas')
    expect(itemConflict(staticData.itemGraph, BOOTS, STEELCAPS)).toBeNull()
  })

  it('never flags an item against its own component tree', () => {
    expect(itemConflict(staticData.itemGraph, SHEEN, TRINITY)).toBeNull()
    expect(itemConflict(staticData.itemGraph, HEXDRINKER, MAW)).toBeNull()
    expect(itemConflict(staticData.itemGraph, BRAMBLE, THORNMAIL)).toBeNull()
    expect(itemConflict(staticData.itemGraph, OBLIVION_ORB, MORELLO)).toBeNull()
  })

  it('exempts starter items sharing a gold passive (Doran + Tear)', () => {
    expect(itemConflict(staticData.itemGraph, DORANS_RING, TEAR)).toBeNull()
  })

  it('stays silent on unrelated defensives (GA vs Zhonya) and same id', () => {
    expect(itemConflict(staticData.itemGraph, GUARDIAN_ANGEL, ZHONYA)).toBeNull()
    expect(itemConflict(staticData.itemGraph, MAW, MAW)).toBeNull()
  })
})

describe('applyExclusivity', () => {
  it('drops a candidate conflicting with an owned item', () => {
    const result = applyExclusivity([makeRec(MAW, 60, staticData)], [SHIELDBOW], staticData)
    expect(result).toEqual([])
  })

  it('keeps the higher-scored of two conflicting candidates and names the loser', () => {
    const result = applyExclusivity(
      [makeRec(SHIELDBOW, 70, staticData), makeRec(MAW, 60, staticData)],
      [],
      staticData
    )
    expect(result.map((r) => r.itemId)).toEqual([SHIELDBOW])
    expect(result[0]?.reasons.join(' ')).toContain('Fauces de Malmortius')
    expect(result[0]?.reasons.join(' ')).toContain('Salvavidas')
  })

  it('allows recommending the upgrade of an owned component', () => {
    const result = applyExclusivity([makeRec(TRINITY, 80, staticData)], [SHEEN], staticData)
    expect(result.map((r) => r.itemId)).toEqual([TRINITY])
  })

  it('leaves non-conflicting and category-only recommendations untouched', () => {
    const categoryRec: Recommendation = {
      itemId: null,
      itemName: null,
      category: 'armadura',
      action: 'add',
      score: 50,
      reasons: ['razón de prueba']
    }
    const input = [
      makeRec(GUARDIAN_ANGEL, 70, staticData),
      makeRec(ZHONYA, 60, staticData),
      categoryRec
    ]
    expect(applyExclusivity(input, [MAW], staticData)).toEqual(input)
  })
})

describe('nextbuy respects exclusivity', () => {
  it('skips a core item conflicting with an owned item and advances', () => {
    const state = structuredClone(mid)
    state.self.items = [makeItem(MAW, staticData)]
    state.self.currentGold = 5000
    const pool: BaselinePool = {
      champions: [
        {
          championId: state.self.championId,
          role: 'BOTTOM',
          core: [SHIELDBOW, TRINITY],
          situational: []
        }
      ]
    }
    const rec = nextBuyRecommendation(state, staticData, pool)
    expect(rec?.itemId).toBe(TRINITY)
  })

  it('skips a situational conflicting with an owned item in the endgame layer', () => {
    const state = structuredClone(mid)
    state.self.items = [makeItem(SHIELDBOW, staticData), makeItem(TRINITY, staticData)]
    state.self.currentGold = 5000
    const pool: BaselinePool = {
      champions: [
        {
          championId: state.self.championId,
          role: 'BOTTOM',
          core: [SHIELDBOW, TRINITY],
          situational: [MAW, GUARDIAN_ANGEL]
        }
      ]
    }
    const rec = endgameRecommendation(state, staticData, pool)
    expect(rec?.itemId).toBe(GUARDIAN_ANGEL)
  })
})

describe('recommend() end-to-end exclusivity', () => {
  // A pool that matches nobody: keeps the baseline layer out of the way.
  const emptyPool: BaselinePool = {
    champions: [
      { championId: '__none__', role: 'MIDDLE', core: [TRINITY, SHEEN], situational: [] }
    ]
  }
  // Meta forcing anti-burst to pick Banshee against the fed Zed in `late`.
  const bansheeMeta = { games: 50, items: [{ itemId: BANSHEE, games: 30, wins: 15 }] }

  it('control: without the conflicting owned item, Banshee IS recommended', () => {
    const recs = recommend(structuredClone(late), staticData, emptyPool, bansheeMeta)
    expect(recs.some((r) => r.itemId === BANSHEE)).toBe(true)
  })

  it('suppresses Banshee when the player owns Edge of Night (shared Anular)', () => {
    const state = structuredClone(late)
    state.self.items.push(makeItem(EDGE_OF_NIGHT, staticData))
    const recs = recommend(state, staticData, emptyPool, bansheeMeta)
    expect(recs.some((r) => r.itemId === BANSHEE)).toBe(false)
  })
})
