import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations } from '@main/db'
import { MetaRepo } from '@main/db/repos'
import { normalizeSnapshot } from '@main/engine/normalize'
import { resolveBaseline, type MetaItemsInput } from '@main/engine/nextbuy'
import { recommend } from '@main/engine/recommend'
import { armorVsMrRule } from '@main/engine/rules/armor-vs-mr'
import { SUGGESTION_SCORE_CAP } from '@main/engine/meta-items'
import { buildScenarioSnapshot } from '@main/devtools-scenario'
import { aggregateMatch, aggregateTimelineOrder } from '@main/riot/meta-aggregate'
import { MetaCrawler, type MetaCrawlerClient } from '@main/riot/metacrawler'
import { RiotApiError } from '@main/riot/client'
import { isFinishedBuildItem } from '@main/staticdata/itemgraph'
import type { StaticData } from '@main/staticdata/manager'
import { matchSchema, timelineSchema, type RiotMatch, type RiotTimeline } from '@shared/schemas/riot'
import { metaSeedSchema } from '@shared/schemas/meta-seed'
import type { GameState } from '@shared/gamestate'
import type { BaselinePool } from '@shared/schemas/baselines'
import type { GameScenario } from '@shared/scenario'
import { loadFixtureStaticData } from './helpers/staticdata'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'riot')
const baseMatch = matchSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, 'match.json'), 'utf8'))
)
const baseTimeline = timelineSchema.parse(
  JSON.parse(readFileSync(join(fixtureDir, 'timeline.json'), 'utf8'))
)

// Fixture facts: participant 3 (Jinx BOTTOM) completes, in order:
// Infinity Edge (3031) → Berserker's (3006, boots) → Lord Dominik's (3036).
const IE = 3031
const BERSERKERS = 3006
const LDR = 3036
const TRINITY = 3078
const ICEBORN = 6662
const THORNMAIL = 3075
const BRAMBLE = 3076
const SHEEN = 3057
const STEELCAPS = 3047
const SPIRIT_VISAGE = 3065

let staticData: StaticData
let isOrderable: (itemId: number) => boolean

beforeAll(async () => {
  staticData = await loadFixtureStaticData()
  isOrderable = (itemId) => {
    const node = staticData.itemGraph.nodes.get(itemId)
    return node !== undefined && isFinishedBuildItem(node)
  }
})

function makeRepo(): MetaRepo {
  const db = new Database(':memory:')
  runMigrations(db)
  return new MetaRepo(db)
}

describe('isFinishedBuildItem', () => {
  it('accepts legendaries and finished boots, rejects components and consumables', () => {
    const node = (id: number): Parameters<typeof isFinishedBuildItem>[0] => {
      const found = staticData.itemGraph.nodes.get(id)
      if (!found) throw new Error(`item ${String(id)} missing`)
      return found
    }
    expect(isFinishedBuildItem(node(IE))).toBe(true)
    expect(isFinishedBuildItem(node(THORNMAIL))).toBe(true)
    expect(isFinishedBuildItem(node(STEELCAPS))).toBe(true) // finished boots upgrade later
    expect(isFinishedBuildItem(node(BRAMBLE))).toBe(false) // component
    expect(isFinishedBuildItem(node(SHEEN))).toBe(false) // component
    expect(isFinishedBuildItem(node(1001))).toBe(false) // basic boots
    expect(isFinishedBuildItem(node(1055))).toBe(false) // starter
  })
})

describe('aggregateTimelineOrder', () => {
  it('extracts completion order per participant (fixture: IE → boots → LDR)', () => {
    const order = aggregateTimelineOrder(baseMatch, baseTimeline, isOrderable)
    expect(order).not.toBeNull()
    if (!order) return
    expect(order.matchId).toBe(baseMatch.metadata.matchId)
    expect(order.patch).toBe('16.13')
    const jinx = order.items.filter((row) => row.champion === 'Jinx')
    expect(jinx.map((row) => [row.itemId, row.slot, row.first])).toEqual([
      [IE, 1, true],
      [BERSERKERS, 2, false],
      [LDR, 3, false]
    ])
    expect(jinx.every((row) => row.role === 'BOTTOM')).toBe(true)
  })

  it('counts a repurchased item once (first occurrence)', () => {
    const doubled = structuredClone(baseTimeline)
    const lastFrame = doubled.info.frames[doubled.info.frames.length - 1]
    lastFrame?.events.push({ type: 'ITEM_PURCHASED', timestamp: 9999000, participantId: 3, itemId: IE })
    const order = aggregateTimelineOrder(baseMatch, doubled, isOrderable)
    const jinxIE = order?.items.filter((row) => row.champion === 'Jinx' && row.itemId === IE)
    expect(jinxIE).toHaveLength(1)
    expect(jinxIE?.[0]?.slot).toBe(1)
  })

  it('rejects a timeline for a different match and non-ranked games', () => {
    const wrong = structuredClone(baseTimeline)
    wrong.metadata.matchId = 'EUW1_OTHER'
    expect(aggregateTimelineOrder(baseMatch, wrong, isOrderable)).toBeNull()

    const aram = structuredClone(baseMatch)
    aram.info.queueId = 450
    expect(aggregateTimelineOrder(aram, baseTimeline, isOrderable)).toBeNull()
  })
})

describe('MetaRepo order stats', () => {
  it('applies order deltas once per match and reads them back', () => {
    const meta = makeRepo()
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    meta.applyAggregate(aggregate)

    const order = aggregateTimelineOrder(baseMatch, baseTimeline, isOrderable)
    if (!order) throw new Error('order null')
    expect(meta.applyOrderAggregate(order)).toBe(true)
    expect(meta.applyOrderAggregate(order)).toBe(false) // hasTimeline already set

    const stats = meta.orderStatsFor('Jinx', 'BOTTOM', '16.13')
    const ie = stats.find((row) => row.itemId === IE)
    expect(ie).toEqual({ itemId: IE, orderGames: 1, slotSum: 1, firstGames: 1 })
    const ldr = stats.find((row) => row.itemId === LDR)
    expect(ldr?.slotSum).toBe(3)
    expect(ldr?.firstGames).toBe(0)
  })

  it('matchesNeedingTimeline lists aggregated matches without order data, never skips', () => {
    const meta = makeRepo()
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    meta.applyAggregate(aggregate)
    meta.markSkipped('EUW1_SKIPPED')
    expect(meta.matchesNeedingTimeline(10)).toEqual([baseMatch.metadata.matchId])

    const order = aggregateTimelineOrder(baseMatch, baseTimeline, isOrderable)
    if (!order) throw new Error('order null')
    meta.applyOrderAggregate(order)
    expect(meta.matchesNeedingTimeline(10)).toEqual([])
  })

  it('itemsFor joins order stats into the item rows', () => {
    const meta = makeRepo()
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    meta.applyAggregate(aggregate)
    const order = aggregateTimelineOrder(baseMatch, baseTimeline, isOrderable)
    if (!order) throw new Error('order null')
    meta.applyOrderAggregate(order)

    const result = meta.itemsFor('Jinx', 'BOTTOM', '16.13', 30)
    const ie = result?.items.find((item) => item.itemId === IE)
    expect(ie?.orderGames).toBe(1)
    expect(ie?.slotSum).toBe(1)
  })
})

describe('resolveBaseline with order data', () => {
  const nasusState = { self: { championId: 'Nasus', position: 'TOP' } } as GameState
  const emptyPool: BaselinePool = {
    champions: [{ championId: '__none__', role: 'TOP', core: [TRINITY], situational: [] }]
  }

  /** Frequency says Thornmail first; completion order says Iceborn → boots → Visage. */
  function orderedMeta(): MetaItemsInput {
    return {
      games: 100,
      items: [
        { itemId: THORNMAIL, games: 80, wins: 44, orderGames: 40, slotSum: 140 }, // avg 3.5
        { itemId: ICEBORN, games: 70, wins: 40, orderGames: 50, slotSum: 60 }, // avg 1.2
        { itemId: STEELCAPS, games: 65, wins: 35, orderGames: 45, slotSum: 95 }, // avg ~2.1
        { itemId: SPIRIT_VISAGE, games: 50, wins: 28, orderGames: 30, slotSum: 90 } // avg 3.0
      ]
    }
  }

  it('orders the core by average completion slot, not frequency', () => {
    const baseline = resolveBaseline(nasusState, staticData, emptyPool, orderedMeta())
    expect(baseline?.source).toBe('meta')
    expect(baseline?.core.slice(0, 4)).toEqual([ICEBORN, STEELCAPS, SPIRIT_VISAGE, THORNMAIL])
  })

  it('excludes components from the baseline even when frequent', () => {
    const meta = orderedMeta()
    meta.items.unshift({ itemId: BRAMBLE, games: 90, wins: 50 }) // most-frequent!
    const baseline = resolveBaseline(nasusState, staticData, emptyPool, meta)
    expect(baseline?.core).not.toContain(BRAMBLE)
    expect(baseline?.situational).not.toContain(BRAMBLE)
  })

  it('keeps frequency order when order coverage is thin (<3 items)', () => {
    const meta = orderedMeta()
    for (const item of meta.items) {
      delete item.orderGames
      delete item.slotSum
    }
    meta.items[0] = { ...meta.items[0], orderGames: 40, slotSum: 140 } as MetaItemsInput['items'][0]
    const baseline = resolveBaseline(nasusState, staticData, emptyPool, meta)
    expect(baseline?.core[0]).toBe(THORNMAIL) // frequency order preserved
  })
})

describe('armor-vs-mr early-game damping', () => {
  const fullAdScenario: GameScenario = {
    gameTimeS: 180,
    gold: 850,
    self: { champion: 'Nasus', position: 'TOP', level: 3, items: [1054] },
    allies: [
      { champion: 'Graves', position: 'JUNGLE' },
      { champion: 'Ahri', position: 'MIDDLE' },
      { champion: 'Jinx', position: 'BOTTOM' },
      { champion: 'Leona', position: 'UTILITY' }
    ],
    enemies: [
      { champion: 'Aatrox', position: 'TOP' },
      { champion: 'Vi', position: 'JUNGLE' },
      { champion: 'Zed', position: 'MIDDLE' },
      { champion: 'Draven', position: 'BOTTOM' },
      { champion: 'Pantheon', position: 'UTILITY' }
    ]
  }

  function makeState(scenario: GameScenario): GameState {
    const { snapshot, errors } = buildScenarioSnapshot(scenario, staticData)
    if (!snapshot) throw new Error(errors.join('; '))
    const state = normalizeSnapshot(snapshot, staticData)
    if (!state) throw new Error('normalize null')
    return state
  }

  it('caps the armor advice while the self has no completed item', () => {
    const state = makeState(fullAdScenario)
    const outputs = armorVsMrRule(state, staticData)
    expect(outputs.length).toBeGreaterThan(0)
    expect(outputs.every((output) => output.score <= SUGGESTION_SCORE_CAP)).toBe(true)
    expect(outputs[0]?.reasons.join(' ')).toContain('primer objeto')
  })

  it('uncaps once the first item is completed', () => {
    const scenario = structuredClone(fullAdScenario)
    scenario.gameTimeS = 1200
    scenario.self.level = 11
    scenario.self.items = [ICEBORN, 1054]
    const outputs = armorVsMrRule(makeState(scenario), staticData)
    expect(outputs.length).toBeGreaterThan(0)
    expect((outputs[0]?.score ?? 0) > SUGGESTION_SCORE_CAP).toBe(true)
  })

  it('REGRESSION: early Nasus vs full AD never gets a component or armor as top pick', () => {
    const state = makeState(fullAdScenario)
    const meta: MetaItemsInput = {
      games: 100,
      items: [
        { itemId: THORNMAIL, games: 80, wins: 44 },
        { itemId: ICEBORN, games: 70, wins: 40, orderGames: 50, slotSum: 60 },
        { itemId: STEELCAPS, games: 65, wins: 35, orderGames: 45, slotSum: 95 },
        { itemId: SPIRIT_VISAGE, games: 50, wins: 28, orderGames: 30, slotSum: 90 }
      ]
    }
    const emptyPool: BaselinePool = {
      champions: [{ championId: '__none__', role: 'TOP', core: [TRINITY], situational: [] }]
    }
    const recs = recommend(state, staticData, emptyPool, meta)
    const top = recs[0]
    expect(top?.itemId).not.toBe(BRAMBLE)
    expect(top?.itemId).not.toBe(THORNMAIL)
    // The top advice advances the real build (Iceborn or one of its components).
    const icebornTree = [ICEBORN, SHEEN, 1028, 1031, 2022]
    expect(icebornTree).toContain(top?.itemId)
  })
})

describe('MetaCrawler with timelines', () => {
  function fakeClient(options: {
    matches: RiotMatch[]
    timelines: Map<string, RiotTimeline>
    seedMatches?: string[]
  }): MetaCrawlerClient & { timelineFetches: string[] } {
    const byId = new Map(options.matches.map((match) => [match.metadata.matchId, match]))
    const timelineFetches: string[] = []
    return {
      timelineFetches,
      apexLeague: (tier) =>
        Promise.resolve({
          ok: true as const,
          value: { tier, entries: tier === 'master' ? [{ puuid: 'SEED_1' }] : [] }
        }),
      matchIds: () =>
        Promise.resolve({ ok: true as const, value: options.seedMatches ?? [...byId.keys()] }),
      match: (matchId) => {
        const match = byId.get(matchId)
        return Promise.resolve(
          match
            ? { ok: true as const, value: match }
            : { ok: false as const, error: new RiotApiError('notFound', '404') }
        )
      },
      timeline: (matchId) => {
        timelineFetches.push(matchId)
        const timeline = options.timelines.get(matchId)
        return Promise.resolve(
          timeline
            ? { ok: true as const, value: timeline }
            : { ok: false as const, error: new RiotApiError('notFound', '404') }
        )
      }
    }
  }

  async function pollUntilDone(crawler: MetaCrawler): Promise<void> {
    for (let i = 0; i < 200 && crawler.status().running; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
  }

  it('fetches the timeline for each new match and stores order stats', async () => {
    const meta = makeRepo()
    const client = fakeClient({
      matches: [baseMatch],
      timelines: new Map([[baseMatch.metadata.matchId, baseTimeline]])
    })
    const crawler = new MetaCrawler({
      client,
      repo: meta,
      onProgress: () => undefined,
      isOrderable
    })
    crawler.start()
    await pollUntilDone(crawler)
    expect(client.timelineFetches).toEqual([baseMatch.metadata.matchId])
    expect(meta.orderStatsFor('Jinx', 'BOTTOM', '16.13').length).toBeGreaterThan(0)
    expect(meta.matchesNeedingTimeline(10)).toEqual([])
  })

  it('keeps the match aggregate when the timeline fetch fails, and backfills later', async () => {
    const meta = makeRepo()
    const failing = fakeClient({ matches: [baseMatch], timelines: new Map() })
    const crawler = new MetaCrawler({
      client: failing,
      repo: meta,
      onProgress: () => undefined,
      isOrderable
    })
    crawler.start()
    await pollUntilDone(crawler)
    // Aggregate kept, timeline pending.
    expect(meta.status()[0]?.matches).toBe(1)
    expect(meta.matchesNeedingTimeline(10)).toEqual([baseMatch.metadata.matchId])

    // Next run with a healthy client: backfill picks it up without new seeds.
    const healthy = fakeClient({
      matches: [baseMatch],
      timelines: new Map([[baseMatch.metadata.matchId, baseTimeline]]),
      seedMatches: []
    })
    const second = new MetaCrawler({
      client: healthy,
      repo: meta,
      onProgress: () => undefined,
      isOrderable
    })
    second.start()
    await pollUntilDone(second)
    expect(healthy.timelineFetches).toEqual([baseMatch.metadata.matchId])
    expect(meta.matchesNeedingTimeline(10)).toEqual([])
    expect(meta.orderStatsFor('Jinx', 'BOTTOM', '16.13').length).toBeGreaterThan(0)
  })
})

describe('meta seed v2 (order rows)', () => {
  it('round-trips order stats through export/import', () => {
    const source = makeRepo()
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    source.applyAggregate(aggregate)
    const order = aggregateTimelineOrder(baseMatch, baseTimeline, isOrderable)
    if (!order) throw new Error('order null')
    source.applyOrderAggregate(order)

    const seed = metaSeedSchema.parse({
      version: 2,
      exportedAt: '2026-07-08T00:00:00Z',
      ...source.exportSeed('16.13')
    })
    expect(seed.itemOrder?.some((row) => row.itemId === IE && row.firstGames === 1)).toBe(true)

    const target = makeRepo()
    expect(target.importSeed(seed)).toBe(true)
    expect(target.orderStatsFor('Jinx', 'BOTTOM', '16.13').find((row) => row.itemId === IE)).toEqual(
      { itemId: IE, orderGames: 1, slotSum: 1, firstGames: 1 }
    )
    // Order data came with the seed: no backfill wanted on this machine.
    expect(target.matchesNeedingTimeline(10)).toEqual([])
  })

  it('still imports a version-1 seed (no order rows) and leaves backfill open', () => {
    const source = makeRepo()
    const aggregate = aggregateMatch(baseMatch)
    if (!aggregate) throw new Error('aggregate null')
    source.applyAggregate(aggregate)
    const exported = source.exportSeed('16.13')
    const v1Fields = { ...exported, itemOrder: undefined }
    const seed = metaSeedSchema.parse({
      version: 1,
      exportedAt: '2026-07-08T00:00:00Z',
      ...v1Fields
    })
    const target = makeRepo()
    expect(target.importSeed(seed)).toBe(true)
    expect(target.matchesNeedingTimeline(10)).toEqual([baseMatch.metadata.matchId])
  })
})
