import type { GameState } from '@shared/gamestate'
import type { Recommendation } from '@shared/recommendation'
import {
  baselinePoolSchema,
  type BaselineChampion,
  type BaselinePool
} from '@shared/schemas/baselines'
import type { StaticData } from '../staticdata/manager'
import { itemConflict } from '../staticdata/itemgraph'
import poolJson from './baselines/pool.json'
import {
  META_ITEM_MIN_GAMES,
  META_TRUST_MIN_GAMES,
  type MetaItemsInput
} from './meta-items'

/** Parsed once; JSON is bundled, so this stays pure (no runtime I/O). */
let cachedPool: BaselinePool | null = null
export function loadBaselinePool(): BaselinePool {
  cachedPool ??= baselinePoolSchema.parse(poolJson)
  return cachedPool
}

/**
 * Magical Footwear (Inspiration, perk 8304): the shop refuses boots until the
 * rune grants free ones (~min 12). While it's equipped and no boots are owned,
 * a boots core slot is unpurchasable and must not pin the next-buy target.
 */
const MAGICAL_FOOTWEAR_RUNE_ID = 8304

/** Starter/early items worth selling once the build is otherwise full. */
const STARTER_ITEM_IDS = new Set([1054, 1055, 1056, 1082, 1083])

/** Trinkets and consumables don't occupy a "real" build slot for our math. */
function occupiesBuildSlot(item: { tags: string[] }): boolean {
  return !item.tags.includes('Trinket') && !item.tags.includes('Consumable')
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

export type { MetaItemsInput } from './meta-items'

export interface EffectiveBaseline {
  core: number[]
  situational: number[]
  /** Reason wording differs: "build Master+" (meta) vs "tu build" (pool). */
  source: 'pool' | 'meta'
}

/**
 * The build the engine advises from. Since 2026-07-07 the hierarchy is
 * inverted (owner request): the Master+ frequency build is PRIMARY whenever
 * the sample is trustworthy — frequency order approximates build order — and
 * the owner's own pool entry is only the fallback for uncrawled champions.
 */
export function resolveBaseline(
  state: GameState,
  staticData: StaticData,
  pool: BaselinePool,
  meta?: MetaItemsInput
): EffectiveBaseline | null {
  if (meta && meta.games >= META_TRUST_MIN_GAMES) {
    const usable = meta.items.filter((entry) => {
      if (entry.games < META_ITEM_MIN_GAMES) return false
      const node = staticData.itemGraph.nodes.get(entry.itemId)
      return (
        node !== undefined && node.availableOnSR && node.depth >= 2 && occupiesBuildSlot(node)
      )
    })
    if (usable.length >= 3) {
      return {
        core: usable.slice(0, 5).map((entry) => entry.itemId),
        situational: usable.slice(5, 10).map((entry) => entry.itemId),
        source: 'meta'
      }
    }
  }
  const own = findBaseline(pool, state.self.championId, state.self.position)
  if (own) return { core: own.core, situational: own.situational, source: 'pool' }
  return null
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
  pool: BaselinePool = loadBaselinePool(),
  meta?: MetaItemsInput
): Recommendation | null {
  const baseline = resolveBaseline(state, staticData, pool, meta)
  if (!baseline) return null

  const graph = staticData.itemGraph
  const ownedCounts = new Map<number, number>()
  for (const item of state.self.items) {
    ownedCounts.set(item.id, (ownedCounts.get(item.id) ?? 0) + 1)
  }

  const ownsAnyBoots = state.self.items.some((item) => item.tags.includes('Boots'))
  const hasMagicalFootwear = state.self.runeIds.includes(MAGICAL_FOOTWEAR_RUNE_ID)

  /** Finished boots other than `coreId` also satisfy a boots core slot. */
  const consumeOtherBoots = (coreId: number): boolean => {
    for (const [ownedId, count] of ownedCounts) {
      if (ownedId === coreId || count <= 0) continue
      const node = graph.nodes.get(ownedId)
      if (node !== undefined && node.tags.includes('Boots') && node.depth >= 2) {
        ownedCounts.set(ownedId, count - 1)
        return true
      }
    }
    return false
  }

  // First core item not yet owned (consuming owned copies in order).
  let target: number | null = null
  let coreIndex = 0
  let bootsSkippedForRune = false
  for (const [index, coreId] of baseline.core.entries()) {
    const owned = ownedCounts.get(coreId) ?? 0
    if (owned > 0) {
      ownedCounts.set(coreId, owned - 1)
      continue
    }
    const isBootsSlot = graph.nodes.get(coreId)?.tags.includes('Boots') ?? false
    if (isBootsSlot && consumeOtherBoots(coreId)) continue
    if (isBootsSlot && hasMagicalFootwear && !ownsAnyBoots) {
      // Unpurchasable until the rune delivers: don't stall the build on it.
      bootsSkippedForRune = true
      continue
    }
    // An owned item from the same exclusivity group covers this slot (WP-012):
    // skip it instead of pinning an unbuyable target and going silent.
    if (state.self.items.some((item) => itemConflict(graph, coreId, item.id) !== null)) {
      continue
    }
    target = coreId
    coreIndex = index
    break
  }
  if (target === null) return null
  const targetName = graph.nodes.get(target)?.name ?? `objeto ${String(target)}`
  const ordinal = ['1º', '2º', '3º', '4º', '5º', '6º'][coreIndex] ?? `${String(coreIndex + 1)}º`
  const gold = state.self.currentGold
  const buildLabel =
    baseline.source === 'pool'
      ? `${ordinal} objeto de tu build de ${state.self.championName}`
      : `${ordinal} objeto más comprado en Master+ con ${state.self.championName} este parche`

  const { missingGold, missingComponents } = missingFor(
    target,
    new Map(ownedCounts),
    staticData
  )

  const withBootsNote = (rec: Recommendation): Recommendation =>
    bootsSkippedForRune
      ? {
          ...rec,
          reasons: [...rec.reasons, 'Botas en pausa: Calzado Mágico (runa) te las dará gratis']
        }
      : rec

  if (gold >= missingGold) {
    return withBootsNote({
      itemId: target,
      itemName: targetName,
      category: null,
      action: 'prioritize',
      score: 80,
      reasons: [
        `${targetName} es el ${buildLabel}`,
        `Puedes completarlo YA: te cuesta ${String(Math.round(missingGold))} de oro y llevas ${String(Math.floor(gold))}`
      ]
    })
  }

  // Partial buy: most expensive affordable missing component.
  const affordable = missingComponents
    .map((id) => graph.nodes.get(id))
    .filter((node) => node !== undefined && node.totalGold <= gold)
    .sort((a, b) => (b?.totalGold ?? 0) - (a?.totalGold ?? 0))
  const component = affordable[0]

  if (component) {
    return withBootsNote({
      itemId: component.id,
      itemName: component.name,
      category: null,
      action: 'add',
      score: 65,
      reasons: [
        `${component.name} (${String(component.totalGold)} de oro) avanza el ${buildLabel}: ${targetName}`,
        `A ${targetName} le faltan ${String(Math.round(missingGold))} de oro en total; llevas ${String(Math.floor(gold))}`
      ]
    })
  }

  return withBootsNote({
    itemId: target,
    itemName: targetName,
    category: null,
    action: 'delay',
    score: 50,
    reasons: [
      `Guarda oro para ${targetName} (${buildLabel}): te faltan ${String(Math.round(missingGold - gold))}`,
      `Ninguna pieza suelta merece la pena ahora mismo (llevas ${String(Math.floor(gold))} de oro)`
    ]
  })
}

/**
 * Endgame layer, once the core build is complete (nextBuyRecommendation
 * returned null): fill the remaining slots with the champion's situational
 * items, and when all six slots are taken but a starter item survives,
 * recommend selling it to make room. Pure, like everything in the engine.
 */
export function endgameRecommendation(
  state: GameState,
  staticData: StaticData,
  pool: BaselinePool = loadBaselinePool(),
  meta?: MetaItemsInput
): Recommendation | null {
  const baseline = resolveBaseline(state, staticData, pool, meta)
  if (!baseline) return null

  const graph = staticData.itemGraph
  const buildItems = state.self.items.filter(occupiesBuildSlot)
  const ownedIds = new Set(buildItems.map((item) => item.id))
  const targetNode = baseline.situational
    .filter((id) => !ownedIds.has(id))
    .map((id) => graph.nodes.get(id))
    .find(
      (node) =>
        node !== undefined &&
        node.availableOnSR &&
        // Exclusivity (WP-012): an owned same-group item rules the pick out.
        !buildItems.some((item) => itemConflict(graph, node.id, item.id) !== null)
    )
  if (!targetNode) return null

  const gold = state.self.currentGold

  if (buildItems.length < 6) {
    const ownedCounts = new Map<number, number>()
    for (const item of buildItems) {
      ownedCounts.set(item.id, (ownedCounts.get(item.id) ?? 0) + 1)
    }
    const { missingGold } = missingFor(targetNode.id, ownedCounts, staticData)
    const affordable = gold >= missingGold
    const situationalLabel =
      baseline.source === 'pool'
        ? `${targetNode.name} es tu situacional`
        : `${targetNode.name} es compra habitual en Master+ con ${state.self.championName}`
    return {
      itemId: targetNode.id,
      itemName: targetNode.name,
      category: null,
      action: affordable ? 'prioritize' : 'add',
      score: affordable ? 75 : 60,
      reasons: [
        `Tu build principal de ${state.self.championName} está completa y te queda hueco: ${situationalLabel}`,
        affordable
          ? `Puedes comprarlo YA: te cuesta ${String(Math.round(missingGold))} de oro y llevas ${String(Math.floor(gold))}`
          : `Te faltan ${String(Math.round(missingGold - gold))} de oro (cuesta ${String(Math.round(missingGold))} y llevas ${String(Math.floor(gold))})`
      ]
    }
  }

  const starter = buildItems.find((item) => STARTER_ITEM_IDS.has(item.id))
  if (!starter) return null
  return {
    itemId: targetNode.id,
    itemName: targetNode.name,
    category: null,
    action: 'replace',
    score: 75,
    reasons: [
      `Inventario lleno pero sigues llevando ${starter.name}: véndelo para liberar hueco`,
      `Con el hueco libre, compra ${targetNode.name} (${String(targetNode.totalGold)} de oro; llevas ${String(Math.floor(gold))})`
    ]
  }
}
