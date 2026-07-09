import type { GameState } from '@shared/gamestate'
import type { Recommendation } from '@shared/recommendation'
import {
  baselinePoolSchema,
  type BaselineChampion,
  type BaselinePool
} from '@shared/schemas/baselines'
import type { Translator, MessageKey } from '@shared/i18n'
import type { StaticData } from '../staticdata/manager'
import { isFinishedBuildItem, itemConflict } from '../staticdata/itemgraph'
import { defaultTranslator } from './rules/helpers'
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
import {
  avgCompletionSlot,
  META_ITEM_MIN_GAMES,
  type MetaItemStat,
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

/** The player's own results moved this item's place/inclusion (WP-018). */
export interface PersonalNote {
  games: number
  wins: number
  kind: 'order' | 'winrate'
}

export interface EffectiveBaseline {
  core: number[]
  situational: number[]
  /** Reason wording differs: Master+ vs the player's own build. */
  source: 'pool' | 'meta' | 'personal'
  /** itemId → why the player's data changed its place (surfaced in reasons). */
  personal?: Map<number, PersonalNote>
}

// WP-018 personalization gates — conservative on purpose: Master+ is the base,
// the player's own results only nudge it, and only with a real sample + edge.
/** Games on the champion before the player's own results are trusted at all. */
const PERSONAL_MIN_GAMES = 8
/** Per-item sample before it can move within/into the build. */
const PERSONAL_ITEM_MIN_GAMES = 5
/** The player's win rate must beat the displaced item's by this to swap. */
const PERSONAL_WR_DELTA = 0.06
/** First-completed sample before we reorder the core to the player's opener. */
const PERSONAL_ORDER_MIN = 4

function winRate(stat: { games: number; wins: number }): number {
  return stat.games > 0 ? stat.wins / stat.games : 0
}

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
    core: usable.slice(0, 5).map((entry) => entry.itemId),
    situational: usable.slice(5, 10).map((entry) => entry.itemId)
  }
}

/**
 * Blend the player's OWN results onto the Master+ base (owner mandate
 * 2026-07-09: "Master+ is the base, my own results only tweak it"). Two
 * conservative, sample-gated nudges: (1) reorder the core to the player's own
 * opener when they clearly start elsewhere, (2) swap in an item the player
 * wins meaningfully more with. Master+ order is untouched below the gates.
 */
function personalize(
  base: { core: number[]; situational: number[] },
  personal: MetaItemsInput | undefined,
  staticData: StaticData
): EffectiveBaseline {
  if (personal === undefined || personal.games < PERSONAL_MIN_GAMES) {
    return { core: base.core, situational: base.situational, source: 'meta' }
  }
  const core = [...base.core]
  const situational = [...base.situational]
  const notes = new Map<number, PersonalNote>()
  const statOf = (id: number): MetaItemStat | undefined =>
    personal.items.find((entry) => entry.itemId === id)

  // (1) Order nudge: the item the player finishes FIRST most often, if it's a
  // core item they don't already open with, moves to the front.
  const opener = personal.items
    .filter((entry) => (entry.firstGames ?? 0) >= PERSONAL_ORDER_MIN && core.includes(entry.itemId))
    .sort((a, b) => (b.firstGames ?? 0) - (a.firstGames ?? 0))[0]
  if (opener !== undefined && core[0] !== opener.itemId) {
    core.splice(core.indexOf(opener.itemId), 1)
    core.unshift(opener.itemId)
    notes.set(opener.itemId, {
      games: opener.firstGames ?? 0,
      wins: opener.wins,
      kind: 'order'
    })
  }

  // (2) Win-rate swap: an item the player wins more with, not already core,
  // displaces the weakest-for-the-player core item (at most one swap).
  const candidate = personal.items
    .filter((entry) => {
      if (entry.games < PERSONAL_ITEM_MIN_GAMES || core.includes(entry.itemId)) return false
      const node = staticData.itemGraph.nodes.get(entry.itemId)
      return node !== undefined && node.availableOnSR && isFinishedBuildItem(node)
    })
    .sort((a, b) => winRate(b) - winRate(a))[0]
  if (candidate !== undefined) {
    // Weakest core item BY THE PLAYER'S OWN results (unknown = neutral 0.5).
    const weakest = core
      .map((id) => ({ id, stat: statOf(id) }))
      .filter((entry) => entry.id !== opener?.itemId)
      .sort(
        (a, b) => (a.stat ? winRate(a.stat) : 0.5) - (b.stat ? winRate(b.stat) : 0.5)
      )[0]
    const weakestWr = weakest?.stat ? winRate(weakest.stat) : 0.5
    if (weakest !== undefined && winRate(candidate) - weakestWr >= PERSONAL_WR_DELTA) {
      core[core.indexOf(weakest.id)] = candidate.itemId
      situational.unshift(weakest.id)
      notes.set(candidate.itemId, {
        games: candidate.games,
        wins: candidate.wins,
        kind: 'winrate'
      })
    }
  }

  return {
    core,
    situational,
    source: 'meta',
    personal: notes.size > 0 ? notes : undefined
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
  const metaBuild = meta ? buildFromDistribution(staticData, meta.items) : null
  if (metaBuild) return personalize(metaBuild, personal, staticData)

  // No Master+ data for this champion → the player's own build carries it,
  // so an off-meta champ they've played before is never left without advice.
  if (personal && personal.games >= PERSONAL_MIN_GAMES) {
    const personalBuild = buildFromDistribution(staticData, personal.items)
    if (personalBuild) {
      return { core: personalBuild.core, situational: personalBuild.situational, source: 'personal' }
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

  const { missingGold, missingComponents } = missingFor(
    target,
    new Map(ownedCounts),
    staticData
  )

  // Personal note (WP-018): if the player's own results moved this item, say
  // so — Master+ is the base, this is the "your data" tweak on top of it.
  const personalNote = baseline.personal?.get(target)
  const personalReason = (note: PersonalNote): string =>
    t(note.kind === 'order' ? 'engine.personal.order' : 'engine.personal.winrate', {
      item: targetName,
      games: String(note.games),
      wr: String(Math.round((note.wins / Math.max(1, note.games)) * 100))
    })
  const withBootsNote = (rec: Recommendation): Recommendation => {
    let reasons = rec.reasons
    if (personalNote !== undefined) reasons = [...reasons, personalReason(personalNote)]
    if (bootsSkippedForRune) reasons = [...reasons, t('engine.nextbuy.bootsPaused')]
    return reasons === rec.reasons ? rec : { ...rec, reasons }
  }

  if (gold >= missingGold) {
    return withBootsNote({
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
    return withBootsNote({
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

  return withBootsNote({
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
