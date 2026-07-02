import type { GameState } from '@shared/gamestate'
import type { Recommendation } from '@shared/recommendation'
import {
  baselinePoolSchema,
  type BaselineChampion,
  type BaselinePool
} from '@shared/schemas/baselines'
import type { StaticData } from '../staticdata/manager'
import poolJson from './baselines/pool.json'

/** Parsed once; JSON is bundled, so this stays pure (no runtime I/O). */
let cachedPool: BaselinePool | null = null
export function loadBaselinePool(): BaselinePool {
  cachedPool ??= baselinePoolSchema.parse(poolJson)
  return cachedPool
}

export function findBaseline(
  pool: BaselinePool,
  championId: string,
  role: string
): BaselineChampion | null {
  const entries = pool.champions.filter((entry) => entry.championId === championId)
  if (entries.length === 0) return null
  return entries.find((entry) => entry.role === role) ?? entries[0] ?? null
}

interface MissingBreakdown {
  /** Gold still needed to finish the item given owned components. */
  missingGold: number
  /** Missing purchasable components (deepest level), for partial buys. */
  missingComponents: number[]
}

/**
 * Recursively computes what's missing for `itemId`, consuming owned
 * components (each owned copy counts once).
 */
export function missingFor(
  itemId: number,
  ownedCounts: Map<number, number>,
  staticData: StaticData
): MissingBreakdown {
  const node = staticData.itemGraph.nodes.get(itemId)
  if (!node) return { missingGold: 0, missingComponents: [] }

  const available = ownedCounts.get(itemId) ?? 0
  if (available > 0) {
    ownedCounts.set(itemId, available - 1)
    return { missingGold: 0, missingComponents: [] }
  }

  if (node.buildsFrom.length === 0) {
    return { missingGold: node.totalGold, missingComponents: [itemId] }
  }

  let missingGold = node.recipeGold
  const missingComponents: number[] = []
  for (const componentId of node.buildsFrom) {
    const sub = missingFor(componentId, ownedCounts, staticData)
    missingGold += sub.missingGold
    if (sub.missingGold > 0) {
      // The component itself is missing (fully or partially).
      missingComponents.push(componentId)
    }
  }
  return { missingGold, missingComponents }
}

/**
 * Baseline next-buy: first unfinished core item, answered at component level
 * and gold-aware. Returns null when the champion is not in the pool or the
 * core build is complete.
 */
export function nextBuyRecommendation(
  state: GameState,
  staticData: StaticData,
  pool: BaselinePool = loadBaselinePool()
): Recommendation | null {
  const baseline = findBaseline(pool, state.self.championId, state.self.position)
  if (!baseline) return null

  const ownedCounts = new Map<number, number>()
  for (const item of state.self.items) {
    ownedCounts.set(item.id, (ownedCounts.get(item.id) ?? 0) + 1)
  }

  // First core item not yet owned (consuming owned copies in order).
  let target: number | null = null
  let coreIndex = 0
  for (const [index, coreId] of baseline.core.entries()) {
    const owned = ownedCounts.get(coreId) ?? 0
    if (owned > 0) {
      ownedCounts.set(coreId, owned - 1)
      continue
    }
    target = coreId
    coreIndex = index
    break
  }
  if (target === null) return null

  const graph = staticData.itemGraph
  const targetName = graph.nodes.get(target)?.name ?? `objeto ${String(target)}`
  const ordinal = ['1º', '2º', '3º', '4º', '5º', '6º'][coreIndex] ?? `${String(coreIndex + 1)}º`
  const gold = state.self.currentGold

  const { missingGold, missingComponents } = missingFor(
    target,
    new Map(ownedCounts),
    staticData
  )

  if (gold >= missingGold) {
    return {
      itemId: target,
      itemName: targetName,
      category: null,
      action: 'prioritize',
      score: 80,
      reasons: [
        `${targetName} es el ${ordinal} objeto de tu build de ${state.self.championName}`,
        `Puedes completarlo YA: te cuesta ${String(Math.round(missingGold))} de oro y llevas ${String(Math.floor(gold))}`
      ]
    }
  }

  // Partial buy: most expensive affordable missing component.
  const affordable = missingComponents
    .map((id) => graph.nodes.get(id))
    .filter((node) => node !== undefined && node.totalGold <= gold)
    .sort((a, b) => (b?.totalGold ?? 0) - (a?.totalGold ?? 0))
  const component = affordable[0]

  if (component) {
    return {
      itemId: component.id,
      itemName: component.name,
      category: null,
      action: 'add',
      score: 65,
      reasons: [
        `${component.name} (${String(component.totalGold)} de oro) avanza tu ${ordinal} objeto: ${targetName}`,
        `A ${targetName} le faltan ${String(Math.round(missingGold))} de oro en total; llevas ${String(Math.floor(gold))}`
      ]
    }
  }

  return {
    itemId: target,
    itemName: targetName,
    category: null,
    action: 'delay',
    score: 50,
    reasons: [
      `Guarda oro para ${targetName} (${ordinal} objeto de tu build): te faltan ${String(Math.round(missingGold - gold))}`,
      `Ninguna pieza suelta merece la pena ahora mismo (llevas ${String(Math.floor(gold))} de oro)`
    ]
  }
}
