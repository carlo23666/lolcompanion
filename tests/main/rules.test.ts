import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { allGameDataSchema } from '@shared/schemas/liveclient'
import type { GameState, GameStateItem } from '@shared/gamestate'
import { normalizeSnapshot } from '@main/engine/normalize'
import { runEngine, combine } from '@main/engine'
import { antihealRule } from '@main/engine/rules/antiheal'
import { antiBurstRule } from '@main/engine/rules/anti-burst'
import { antiTankRule } from '@main/engine/rules/anti-tank'
import { armorVsMrRule } from '@main/engine/rules/armor-vs-mr'
import { spikeNowRule } from '@main/engine/rules/spike-now'
import type { StaticData } from '@main/staticdata/manager'
import { loadFixtureStaticData } from './helpers/staticdata'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'liveclient')

let staticData: StaticData
let early: GameState
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
  early = load('early')
  mid = load('mid')
  late = load('late')
})

/**
 * WP-018: reactive rules only surface items the champion's Master+ players
 * actually build. This backs every reactive candidate (defensives, resists,
 * %pen) so the rules that SHOULD fire have their anchor; tests for the
 * silent-without-backing behavior pass their own (or no) meta.
 */
const REACTIVE_META = {
  games: 300,
  items: [
    { itemId: 3026, games: 40, wins: 22 }, // Guardian Angel
    { itemId: 3157, games: 30, wins: 16 }, // Zhonya
    { itemId: 3075, games: 40, wins: 22 }, // Thornmail
    { itemId: 3143, games: 30, wins: 16 }, // Randuin
    { itemId: 3110, games: 20, wins: 11 }, // Frozen Heart
    { itemId: 3102, games: 35, wins: 19 }, // Banshee
    { itemId: 2504, games: 30, wins: 16 }, // Kaenic Rookern
    { itemId: 3036, games: 40, wins: 22 }, // Lord Dominik's
    { itemId: 6694, games: 30, wins: 16 }, // Serylda
    { itemId: 3135, games: 40, wins: 22 }, // Void Staff
    { itemId: 6653, games: 30, wins: 16 }, // Liandry
    { itemId: 3153, games: 20, wins: 11 }, // BotRK
    { itemId: 3139, games: 25, wins: 14 } // Mercurial
  ]
}

describe('rule: antiheal', () => {
  it('triggers on high enemy healing (Aatrox+Soraka) with gold-aware action', () => {
    const outputs = antihealRule(mid, staticData)
    expect(outputs).toHaveLength(1)
    const output = outputs[0]
    // Self (Jinx, AD) → Executioner's Calling, affordable with 1250 gold.
    expect(output?.itemId).toBe(3123)
    expect(output?.action).toBe('add')
    expect(output?.reasons.join(' ')).toContain('Soraka')
    expect(output?.reasons.join(' ')).toMatch(/\d+ de oro/)
  })

  it('recommends the delay action when gold is short', () => {
    const poor = structuredClone(mid)
    poor.self.currentGold = 100
    const outputs = antihealRule(poor, staticData)
    expect(outputs[0]?.action).toBe('delay')
    expect(outputs[0]?.reasons.join(' ')).toContain('te faltan')
  })

  it('recommends the magic option for AP self', () => {
    const apSelf = structuredClone(mid)
    apSelf.self.damageType = 'magic'
    apSelf.self.items = []
    const outputs = antihealRule(apSelf, staticData)
    expect(outputs[0]?.itemId).toBe(3916)
  })

  it('stays silent below the healing threshold', () => {
    const calm = structuredClone(mid)
    calm.enemyAggregates.healingIndex = 2
    expect(antihealRule(calm, staticData)).toEqual([])
  })

  it('stays silent when self already owns antiheal', () => {
    const covered = structuredClone(mid)
    covered.self.items.push(makeItem(3123, staticData))
    expect(antihealRule(covered, staticData)).toEqual([])
  })
})

describe('rule: armor-vs-mr', () => {
  it('recommends every squishy armor option against the 80% physical comp, preferred first', () => {
    const outputs = armorVsMrRule(mid, staticData, REACTIVE_META)
    // Jinx (Marksman) → squishy options: GA preferred, Zhonya as alternative.
    expect(outputs.map((o) => o.itemId)).toEqual([3026, 3157])
    const [preferred, alternative] = outputs
    expect(preferred?.category).toBe('armadura')
    expect(preferred?.reasons[0]).toMatch(/El \d+% del daño enemigo estimado es físico/)
    // Shared situational reasons; each option carries its own Master+ WR line.
    expect(alternative?.reasons.slice(0, 2)).toEqual(preferred?.reasons.slice(0, 2))
    expect(alternative?.score).toBeLessThan(preferred?.score ?? 0)
  })

  it('recommends tank armor items for a tank self', () => {
    const tankSelf = structuredClone(mid)
    tankSelf.self.championId = 'Malphite' // Tank tag
    const outputs = armorVsMrRule(tankSelf, staticData, REACTIVE_META)
    expect(outputs[0]?.itemId).toBe(3075)
    expect(outputs.length).toBeGreaterThan(1)
  })

  it('recommends MR when magic damage dominates', () => {
    const magicComp = structuredClone(mid)
    magicComp.enemyAggregates.physicalShare = 0.3
    magicComp.enemyAggregates.magicShare = 0.7
    const outputs = armorVsMrRule(magicComp, staticData, REACTIVE_META)
    expect(outputs.length).toBeGreaterThan(0)
    expect(outputs.every((o) => o.category === 'resistencia mágica')).toBe(true)
  })

  it('WP-018: no meta-backed resist → silent (a support never gets Guardian Angel)', () => {
    // Trusted Master+ sample that builds NONE of the squishy armor options
    // (an enchanter): the AD comp must not conjure GA/Zhonya anyway.
    const supportMeta = { games: 300, items: [{ itemId: 3031, games: 120, wins: 66 }] }
    expect(armorVsMrRule(mid, staticData, supportMeta)).toEqual([])
    // And with no meta at all, still nothing (no anchor).
    expect(armorVsMrRule(mid, staticData)).toEqual([])
  })

  it('goes silent when self already owns any option of the advised class', () => {
    // Real-world capture (2026-07-02): owner had Zhonya, the rule kept
    // recommending GA — and kept firing after buying GA too.
    const covered = structuredClone(mid)
    covered.self.items.push(makeItem(3157, staticData)) // Zhonya owned
    expect(armorVsMrRule(covered, staticData)).toEqual([])
    covered.self.items.push(makeItem(3026, staticData)) // both owned
    expect(armorVsMrRule(covered, staticData)).toEqual([])
  })

  it('stays silent on an even damage split', () => {
    const even = structuredClone(mid)
    even.enemyAggregates.physicalShare = 0.5
    even.enemyAggregates.magicShare = 0.5
    expect(armorVsMrRule(even, staticData)).toEqual([])
  })
})

describe('rule: anti-tank', () => {
  it('triggers on the late-game raid boss (Aatrox, ~7600 eHP)', () => {
    const outputs = antiTankRule(late, staticData, REACTIVE_META)
    // Self AD, Aatrox stacks resists → % armor pen: LDR preferred, Serylda alternative.
    expect(outputs.map((o) => o.itemId)).toEqual([3036, 6694])
    const output = outputs[0]
    expect(output?.reasons.join(' ')).toContain('Aatrox')
    expect(output?.reasons.join(' ')).toMatch(/\d+ de HP efectiva/)
    expect(outputs[1]?.score).toBeLessThan(output?.score ?? 0)
  })

  it('recommends magic pen for an AP self', () => {
    const apSelf = structuredClone(late)
    apSelf.self.damageType = 'magic'
    apSelf.self.items = []
    const outputs = antiTankRule(apSelf, staticData, REACTIVE_META)
    expect(outputs[0]?.itemId).toBe(3135)
  })

  it('goes silent once self owns any anti-tank option', () => {
    const covered = structuredClone(late)
    covered.self.items.push(makeItem(3036, staticData)) // LDR owned
    expect(antiTankRule(covered, staticData)).toEqual([])
  })

  it('stays silent mid game when nobody outgrew the baseline', () => {
    expect(antiTankRule(mid, staticData)).toEqual([])
  })

  it('stays silent early', () => {
    expect(antiTankRule(early, staticData)).toEqual([])
  })
})

describe('rule: anti-burst', () => {
  it('triggers on fed Zed (8/3) late and picks the meta-backed defensive (GA)', () => {
    const outputs = antiBurstRule(late, staticData, REACTIVE_META)
    expect(outputs).toHaveLength(1)
    const output = outputs[0]
    expect(output?.itemId).toBe(3026) // GA is this champion's most-built defensive
    expect(output?.reasons[0]).toContain('Zed (8/3)')
    expect(output?.reasons[0]).toContain('+5')
  })

  it('picks whichever survival item Master+ builds most (Zhonya here)', () => {
    // The pick follows Master+ usage, not the self AD/AP split (WP-018).
    const zhonyaMeta = { games: 300, items: [{ itemId: 3157, games: 60, wins: 33 }] }
    const outputs = antiBurstRule(late, staticData, zhonyaMeta)
    expect(outputs[0]?.itemId).toBe(3157)
  })

  it('stays silent mid game (Zed only +3) — fed fighters do not count', () => {
    // Mid: Zed 4/1 (diff 3 < 4), Aatrox 5/2 is a Fighter, not burst.
    expect(antiBurstRule(mid, staticData)).toEqual([])
  })

  it('stays silent when self already owns a defensive', () => {
    const covered = structuredClone(late)
    covered.self.items.push(makeItem(3026, staticData))
    expect(antiBurstRule(covered, staticData)).toEqual([])
  })
})

describe('rules are Master+-aware (meta primero, 2026-07-07)', () => {
  it('anti-burst picks the defensive Master+ players build, not the class heuristic', () => {
    // AD self would get GA heuristically; Master+ on this champion buy Mercurial.
    const meta = { games: 300, items: [{ itemId: 3139, games: 60, wins: 33 }] }
    const outputs = antiBurstRule(late, staticData, meta)
    expect(outputs[0]?.itemId).toBe(3139)
    expect(outputs[0]?.reasons.join(' ')).toContain('Master+')
  })

  it('WP-018: no meta-backed defensive → anti-burst stays silent (no heuristic)', () => {
    // Trusted sample, but no defensive appears in the champion distribution:
    // the rule must NOT invent GA/Zhonya — it stays silent.
    const meta = { games: 300, items: [{ itemId: 3031, games: 200, wins: 110 }] }
    expect(antiBurstRule(late, staticData, meta)).toEqual([])
  })

  it('antiheal line follows Master+ (Morello line despite a physical self)', () => {
    const state = structuredClone(late)
    state.enemyAggregates.healingIndex = 999
    state.self.items = state.self.items.filter(
      (item) => ![3123, 3033, 6609, 3916, 3165].includes(item.id)
    )
    const meta = { games: 300, items: [{ itemId: 3165, games: 50, wins: 27 }] }
    const outputs = antihealRule(state, staticData, meta)
    expect(outputs[0]?.itemId).toBe(3916) // Oblivion Orb: component of the meta line
    expect(outputs[0]?.reasons.join(' ')).toContain('Master+')
  })

  it('without any meta anti-burst stays silent (nothing to anchor to)', () => {
    expect(antiBurstRule(late, staticData)).toEqual([])
  })
})

describe('rule: spike-now', () => {
  function selfWith(items: number[], gold: number): GameState {
    const state = structuredClone(early)
    state.self.items = items.map((id) => makeItem(id, staticData))
    state.self.currentGold = gold
    return state
  }

  it('buy now: all IE components + enough gold for the recipe (725)', () => {
    const state = selfWith([1038, 1037, 1018], 800)
    const outputs = spikeNowRule(state, staticData)
    expect(outputs[0]?.itemId).toBe(3031)
    expect(outputs[0]?.action).toBe('prioritize')
    expect(outputs[0]?.reasons[0]).toContain('YA')
  })

  it('wait: 25 gold short of the IE recipe', () => {
    const state = selfWith([1038, 1037, 1018], 700)
    const outputs = spikeNowRule(state, staticData)
    expect(outputs[0]?.itemId).toBe(3031)
    expect(outputs[0]?.action).toBe('delay')
    expect(outputs[0]?.reasons[0]).toContain('25')
  })

  it('next-base target when the completion is further out', () => {
    const state = selfWith([1038, 1037, 1018], 100)
    const outputs = spikeNowRule(state, staticData)
    expect(outputs[0]?.action).toBe('add')
  })

  it('stays silent with no components in inventory', () => {
    const state = selfWith([], 3000)
    expect(spikeNowRule(state, staticData)).toEqual([])
  })

  it('mid fixture: silent — Zeal upgrades are ~1450 gold away (> spike window)', () => {
    expect(spikeNowRule(mid, staticData)).toEqual([])
  })

  it('recommends a Zeal upgrade when close to completing it', () => {
    const state = structuredClone(mid)
    state.self.currentGold = 1500 // Runaan's missing ≈ 1450 → buy now
    const outputs = spikeNowRule(state, staticData)
    expect(outputs).toHaveLength(1)
    const zealUpgrades = staticData.itemGraph.nodes.get(3086)?.buildsInto ?? []
    expect(zealUpgrades).toContain(outputs[0]?.itemId)
    expect(outputs[0]?.action).toBe('prioritize')
  })
})

describe('combiner + runEngine', () => {
  it('merges outputs for the same item and keeps every reason', () => {
    const merged = combine(
      [
        { ruleId: 'a', itemId: 3026, action: 'add', score: 50, reasons: ['razón A'] },
        { ruleId: 'b', itemId: 3026, action: 'prioritize', score: 40, reasons: ['razón B'] },
        { ruleId: 'c', category: 'otra', action: 'add', score: 90, reasons: ['razón C'] }
      ],
      staticData
    )
    expect(merged).toHaveLength(2)
    expect(merged[0]?.score).toBe(90)
    const ga = merged.find((r) => r.itemId === 3026)
    expect(ga?.score).toBe(60) // max 50 + 10 for the second supporting rule
    expect(ga?.action).toBe('prioritize')
    expect(ga?.reasons).toEqual(['razón A', 'razón B'])
    expect(ga?.itemName).toContain('ngel') // "Ángel de la guarda" (es_ES)
  })

  it('produces a ranked, explained top for mid and late game', () => {
    for (const state of [mid, late]) {
      const recommendations = runEngine(state, staticData, REACTIVE_META)
      expect(recommendations.length).toBeGreaterThanOrEqual(2)
      for (const rec of recommendations) {
        expect(rec.reasons.length).toBeGreaterThan(0)
        expect(rec.score).toBeGreaterThan(0)
        expect(rec.score).toBeLessThanOrEqual(100)
      }
      const scores = recommendations.map((r) => r.score)
      expect(scores).toEqual([...scores].sort((a, b) => b - a))
    }
  })

  it('late game: anti-burst and armor advice both surface GA and merge', () => {
    const recommendations = runEngine(late, staticData, REACTIVE_META)
    const ga = recommendations.find((r) => r.itemId === 3026)
    expect(ga).toBeDefined()
    // Two rules supported it → reasons from both.
    expect(ga?.reasons.join(' ')).toContain('físico')
    expect(ga?.reasons.join(' ')).toContain('Zed')
  })
})

describe('engine purity (no I/O)', () => {
  it('engine sources import no I/O modules', () => {
    const engineDir = join(import.meta.dirname, '..', '..', 'src', 'main', 'engine')
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
      )
    const forbidden = [
      "from 'electron'",
      "from 'node:fs'",
      "from 'node:https'",
      "from 'node:http'",
      "from 'better-sqlite3'",
      "from '../ipc'",
      "from '../../ipc'"
    ]
    for (const file of walk(engineDir).filter((f) => f.endsWith('.ts'))) {
      const source = readFileSync(file, 'utf8')
      for (const pattern of forbidden) {
        expect(source.includes(pattern), `${file} contains ${pattern}`).toBe(false)
      }
    }
  })
})
