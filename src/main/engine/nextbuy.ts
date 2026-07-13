import type { GameState } from '@shared/gamestate'
import type { Recommendation, RecommendationPlan } from '@shared/recommendation'
import {
  baselinePoolSchema,
  type BaselineChampion,
  type BaselinePool
} from '@shared/schemas/baselines'
import type { Translator, MessageKey } from '@shared/i18n'
import type { StaticData } from '../staticdata/manager'
import { isFinishedBuildItem, itemConflict } from '../staticdata/itemgraph'
import { STARTER_ITEM_IDS } from '../staticdata/starters'
import { defaultTranslator } from './rules/helpers'
import { selectBuildRoute, type RouteSelection } from './build-routes'
import {
  avgCompletionSlot,
  META_ITEM_MIN_GAMES,
  type MetaItemStat,
  type MetaItemsInput
} from './meta-items'
import poolJson from './baselines/pool.json'

/** 1-based completion-slot labels, localized (engine.ordinal.1..6). */
const ORDINAL_KEYS: readonly MessageKey[] = [
  'engine.ordinal.1',
  'engine.ordinal.2',
  'engine.ordinal.3',
  'engine.ordinal.4',
  'engine.ordinal.5',
  'engine.ordinal.6'
]

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
  /** Reason wording differs: Master+ vs the player's own build. */
  source: 'pool' | 'meta' | 'personal'
  starterId?: number | null
  route?: RouteSelection
}

/** Games on the champion before the player's own results are trusted at all. */
const PERSONAL_MIN_GAMES = 8

/**
 * Finished-item build straight from a Master+ (or personal) item distribution,
 * order-aware. Components are excluded (never build SLOTS — the "Bramble first
 * on Nasus" bug, WP-015). Returns null below three usable finished items.
 */
function buildFromDistribution(
  staticData: StaticData,
  items: MetaItemStat[]
): { core: number[]; situational: number[] } | null {
  const usable = items.filter((entry) => {
    if (entry.games < META_ITEM_MIN_GAMES) return false
    const node = staticData.itemGraph.nodes.get(entry.itemId)
    return node !== undefined && isFinishedBuildItem(node)
  })
  // With enough timeline coverage, REAL completion order beats frequency (a
  // popular-but-late Thornmail must not become the "first core item"). Items
  // without an order sample keep their frequency rank at the tail.
  const ordered = usable.filter((entry) => avgCompletionSlot(entry) !== null)
  if (ordered.length >= 3) {
    usable.sort((a, b) => {
      const slotA = avgCompletionSlot(a)
      const slotB = avgCompletionSlot(b)
      if (slotA !== null && slotB !== null) return slotA - slotB
      if (slotA !== null) return -1
      if (slotB !== null) return 1
      return b.games - a.games
    })
  }
  if (usable.length < 3) return null
  return {
    // Legacy v1/v2 data has no co-occurrence. Keep only three ordered items
    // as inferred core; later frequency picks remain contextual options.
    core: usable.slice(0, 3).map((entry) => entry.itemId),
    situational: usable.slice(3, 10).map((entry) => entry.itemId)
  }
}

/**
 * The build the engine advises from. Master+ is the PRIMARY base whenever any
 * usable sample exists (thin data still beats nothing — WP-018 never-silent);
 * the player's own results then nudge order/inclusion; the bundled pool and the
 * player's raw build are the last resorts before giving up.
 */
export function resolveBaseline(
  state: GameState,
  staticData: StaticData,
  pool: BaselinePool,
  meta?: MetaItemsInput,
  personal?: MetaItemsInput
): EffectiveBaseline | null {
  const route = selectBuildRoute(state, staticData, meta, personal)
  if (route !== null) {
    const routeSet = new Set(route.core)
    const situational = (meta?.items ?? [])
      .map((entry) => entry.itemId)
      .filter((itemId) => !routeSet.has(itemId))
      .filter((itemId) => {
        const node = staticData.itemGraph.nodes.get(itemId)
        return node !== undefined && isFinishedBuildItem(node)
      })
      .slice(0, 7)
    return {
      core: route.core,
      situational,
      source: 'meta',
      starterId: route.starterId,
      route
    }
  }

  const metaBuild = meta ? buildFromDistribution(staticData, meta.items) : null
  if (metaBuild) return { ...metaBuild, source: 'meta' }

  // No Master+ data for this champion → the player's own build carries it,
  // so an off-meta champ they've played before is never left without advice.
  if (personal && personal.games >= PERSONAL_MIN_GAMES) {
    const personalRoute = selectBuildRoute(state, staticData, personal, undefined)
    if (personalRoute !== null) {
      return {
        core: personalRoute.core,
        situational: [],
        source: 'personal',
        starterId: personalRoute.starterId,
        route: personalRoute
      }
    }
    const personalBuild = buildFromDistribution(staticData, personal.items)
    if (personalBuild) {
      return {
        core: personalBuild.core,
        situational: personalBuild.situational,
        source: 'personal'
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

/** Number of the first two non-boots route spikes not yet completed. */
export function protectedCoreRemaining(
  state: GameState,
  staticData: StaticData,
  baseline: EffectiveBaseline
): number {
  const protectedIds = baseline.core
    .filter((id) => !staticData.itemGraph.nodes.get(id)?.tags.includes('Boots'))
    .slice(0, 2)
  const owned = new Set(state.self.items.filter((item) => item.isCompleted).map((item) => item.id))
  return protectedIds.filter((id) => !owned.has(id)).length
}

function recommendationPlan(
  state: GameState,
  staticData: StaticData,
  baseline: EffectiveBaseline
): RecommendationPlan {
  const owned = new Set(state.self.items.filter((item) => item.isCompleted).map((item) => item.id))
  const steps = baseline.core.map((itemId) => ({
    itemId,
    itemName: staticData.itemGraph.nodes.get(itemId)?.name ?? `#${String(itemId)}`,
    owned: owned.has(itemId)
  }))
  const firstMissing = steps.findIndex((step) => !step.owned)
  return {
    source:
      baseline.source === 'pool'
        ? 'pool'
        : baseline.source === 'personal'
          ? 'personal-route'
          : baseline.route !== undefined
            ? 'meta-route'
            : 'meta-inferred',
    confidence: baseline.route?.confidence ?? (baseline.source === 'pool' ? 0.55 : 0.48),
    steps,
    currentStep: firstMissing < 0 ? steps.length : firstMissing,
    protectedCoreRemaining: protectedCoreRemaining(state, staticData, baseline),
    personalAdjusted: baseline.route?.personalAdjusted ?? false,
    damageAdjusted: baseline.route?.damageAdjusted ?? false
  }
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
  meta?: MetaItemsInput,
  t: Translator = defaultTranslator,
  personal?: MetaItemsInput
): Recommendation | null {
  const baseline = resolveBaseline(state, staticData, pool, meta, personal)
  if (!baseline) return null

  const graph = staticData.itemGraph
  const ownedCounts = new Map<number, number>()
  for (const item of state.self.items) {
    ownedCounts.set(item.id, (ownedCounts.get(item.id) ?? 0) + 1)
  }

  const withRouteContext = (rec: Recommendation): Recommendation => {
    const reasons = [...rec.reasons]
    if (baseline.route !== undefined) {
      reasons.push(
        t('engine.route.observed', {
          games: String(baseline.route.games),
          confidence: String(Math.round(baseline.route.confidence * 100))
        })
      )
      if (baseline.route.personalAdjusted) reasons.push(t('engine.route.personal'))
      if (baseline.route.damageAdjusted) reasons.push(t('engine.route.damage'))
    } else if (baseline.source === 'meta') {
      reasons.push(t('engine.route.inferred'))
    }
    return {
      ...rec,
      kind: 'route',
      plan: recommendationPlan(state, staticData, baseline),
      reasons
    }
  }

  // The first shop is a distinct phase. v3 routes retain the actual starter
  // bought by Master+ players; once the player commits to any non-consumable
  // purchase, respect that decision and continue with the finished route.
  const starterId = baseline.starterId ?? null
  const ownsStarter = state.self.items.some((item) => STARTER_ITEM_IDS.has(item.id))
  const hasCommittedPurchase = state.self.items.some(occupiesBuildSlot)
  const starterNode = starterId === null ? undefined : graph.nodes.get(starterId)
  if (
    state.gameTimeS <= 180 &&
    !ownsStarter &&
    !hasCommittedPurchase &&
    starterNode !== undefined &&
    starterNode.availableOnSR
  ) {
    const affordable = state.self.currentGold >= starterNode.totalGold
    return withRouteContext({
      itemId: starterNode.id,
      itemName: starterNode.name,
      category: null,
      action: affordable ? 'prioritize' : 'delay',
      score: affordable ? 84 : 52,
      reasons: [
        t('engine.starter.route', {
          item: starterNode.name,
          games: String(baseline.route?.games ?? 0)
        }),
        affordable
          ? t('engine.starter.affordable', {
              cost: String(starterNode.totalGold),
              gold: String(Math.floor(state.self.currentGold))
            })
          : t('engine.starter.short', {
              item: starterNode.name,
              missing: String(Math.ceil(starterNode.totalGold - state.self.currentGold))
            })
      ]
    })
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
  const targetName = graph.nodes.get(target)?.name ?? `#${String(target)}`
  const ordinal = t(ORDINAL_KEYS[Math.min(coreIndex, 5)] ?? 'engine.ordinal.6')
  const gold = state.self.currentGold
  const buildLabel =
    baseline.source === 'pool'
      ? t('engine.nextbuy.labelPool', { ordinal, champion: state.self.championName })
      : t('engine.nextbuy.labelMeta', { ordinal, champion: state.self.championName })

  const { missingGold, missingComponents } = missingFor(target, new Map(ownedCounts), staticData)

  const withNotes = (rec: Recommendation): Recommendation => {
    const withBoots = bootsSkippedForRune
      ? { ...rec, reasons: [...rec.reasons, t('engine.nextbuy.bootsPaused')] }
      : rec
    return withRouteContext(withBoots)
  }

  if (gold >= missingGold) {
    return withNotes({
      itemId: target,
      itemName: targetName,
      category: null,
      action: 'prioritize',
      score: 80,
      reasons: [
        t('engine.nextbuy.isLabel', { item: targetName, label: buildLabel }),
        t('engine.nextbuy.canFinishNow', {
          cost: String(Math.round(missingGold)),
          gold: String(Math.floor(gold))
        })
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
    return withNotes({
      itemId: component.id,
      itemName: component.name,
      category: null,
      action: 'add',
      score: 65,
      reasons: [
        t('engine.nextbuy.component', {
          component: component.name,
          cost: String(component.totalGold),
          label: buildLabel,
          target: targetName
        }),
        t('engine.nextbuy.componentGold', {
          target: targetName,
          missing: String(Math.round(missingGold)),
          gold: String(Math.floor(gold))
        })
      ]
    })
  }

  return withNotes({
    itemId: target,
    itemName: targetName,
    category: null,
    action: 'delay',
    score: 50,
    reasons: [
      t('engine.nextbuy.saveFor', {
        target: targetName,
        label: buildLabel,
        missing: String(Math.round(missingGold - gold))
      }),
      t('engine.nextbuy.noPiece', { gold: String(Math.floor(gold)) })
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
  meta?: MetaItemsInput,
  t: Translator = defaultTranslator,
  personal?: MetaItemsInput
): Recommendation | null {
  const baseline = resolveBaseline(state, staticData, pool, meta, personal)
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
        ? t('engine.endgame.situPool', { item: targetNode.name })
        : t('engine.endgame.situMeta', {
            item: targetNode.name,
            champion: state.self.championName
          })
    return {
      itemId: targetNode.id,
      itemName: targetNode.name,
      category: null,
      action: affordable ? 'prioritize' : 'add',
      score: affordable ? 75 : 60,
      reasons: [
        t('engine.endgame.coreDone', {
          champion: state.self.championName,
          situational: situationalLabel
        }),
        affordable
          ? t('engine.endgame.buyNow', {
              cost: String(Math.round(missingGold)),
              gold: String(Math.floor(gold))
            })
          : t('engine.endgame.shortGold', {
              missing: String(Math.round(missingGold - gold)),
              cost: String(Math.round(missingGold)),
              gold: String(Math.floor(gold))
            })
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
      t('engine.endgame.sellStarter', { starter: starter.name }),
      t('engine.endgame.thenBuy', {
        item: targetNode.name,
        cost: String(targetNode.totalGold),
        gold: String(Math.floor(gold))
      })
    ]
  }
}
