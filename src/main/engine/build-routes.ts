import type { GameState } from '@shared/gamestate'
import type { StaticData } from '../staticdata/manager'
import { isFinishedBuildItem } from '../staticdata/itemgraph'
import { META_ROUTE_MIN_GAMES, type MetaBuildRoute, type MetaItemsInput } from './meta-items'

const PERSONAL_ROUTE_MIN_GAMES = 12
const PERSONAL_ROUTE_FAMILY_MIN = 4
const PRIOR_STRENGTH = 16

export interface RouteSelection {
  starterId: number | null
  core: number[]
  games: number
  wins: number
  confidence: number
  personalAdjusted: boolean
  damageAdjusted: boolean
}

interface ScoredRoute {
  route: MetaBuildRoute
  core: number[]
  score: number
  personalAdjusted: boolean
  damageAdjusted: boolean
}

function canonicalCore(route: MetaBuildRoute, staticData: StaticData): number[] {
  const seen = new Set<number>()
  return route.items
    .filter((itemId) => {
      if (seen.has(itemId)) return false
      const node = staticData.itemGraph.nodes.get(itemId)
      if (node === undefined || !isFinishedBuildItem(node)) return false
      seen.add(itemId)
      return true
    })
    .slice(0, 4)
}

/** First two non-boots define a stable route family despite boot timing. */
function routeFamily(items: readonly number[], staticData: StaticData): string {
  return items
    .filter((id) => !staticData.itemGraph.nodes.get(id)?.tags.includes('Boots'))
    .slice(0, 2)
    .join(',')
}

function itemDamageAffinity(itemId: number, staticData: StaticData): number {
  const stats = staticData.itemGraph.nodes.get(itemId)?.stats ?? {}
  const physical =
    (stats['FlatPhysicalDamageMod'] ?? 0) +
    (stats['PercentAttackSpeedMod'] ?? 0) * 65 +
    (stats['FlatCritChanceMod'] ?? 0) * 90
  const magic = (stats['FlatMagicDamageMod'] ?? 0) + (stats['FlatMPPoolMod'] ?? 0) * 0.04
  const total = physical + magic
  return total <= 0 ? 0 : (physical - magic) / total
}

function routeDamageAffinity(items: readonly number[], staticData: StaticData): number {
  if (items.length === 0) return 0
  return (
    items.reduce((sum, itemId) => sum + itemDamageAffinity(itemId, staticData), 0) / items.length
  )
}

function completedOwned(state: GameState): number[] {
  return state.self.items.filter((item) => item.isCompleted).map((item) => item.id)
}

/**
 * Selects one coherent observed Master+ route. Current inventory is the
 * strongest signal; usage is the prior; team damage only breaks ties between
 * valid observed routes; personal data contributes shrunk route frequency,
 * never raw "win rate when built".
 */
export function selectBuildRoute(
  state: GameState,
  staticData: StaticData,
  meta: MetaItemsInput | undefined,
  personal: MetaItemsInput | undefined
): RouteSelection | null {
  if (meta?.routes === undefined) return null
  const candidates = meta.routes
    .filter((route) => route.games >= META_ROUTE_MIN_GAMES)
    .map((route) => ({ route, core: canonicalCore(route, staticData) }))
    .filter((entry) => entry.core.length >= 2)
  if (candidates.length === 0) return null

  const totalRouteGames = candidates.reduce((sum, entry) => sum + entry.route.games, 0)
  const owned = completedOwned(state)
  const allyImbalance = state.allyAggregates.physicalShare - state.allyAggregates.magicShare
  const personalRoutes =
    personal !== undefined && personal.games >= PERSONAL_ROUTE_MIN_GAMES
      ? (personal.routes ?? [])
      : []
  const personalGames = personal?.games ?? 0

  const scored: ScoredRoute[] = candidates.map(({ route, core }) => {
    let score = Math.log1p(route.games) * 18

    // Stay on the route the player already committed to. Ordered prefix gets
    // extra weight; completed off-route items are tolerated as adaptations.
    for (const [index, itemId] of owned.entries()) {
      const routeIndex = core.indexOf(itemId)
      if (routeIndex >= 0) score += routeIndex === index ? 30 : 18
      else score -= 4
    }

    // If allies are magic-heavy, positive (physical) affinity is valuable;
    // if allies are physical-heavy, negative (magic) affinity is valuable.
    const affinity = routeDamageAffinity(core, staticData)
    const balanceBoost = allyImbalance * -affinity * 22
    score += balanceBoost

    let personalAdjusted = false
    if (personalRoutes.length > 0) {
      const family = routeFamily(core, staticData)
      const familyGames = personalRoutes
        .filter((candidate) => routeFamily(candidate.items, staticData) === family)
        .reduce((sum, candidate) => sum + candidate.games, 0)
      if (familyGames >= PERSONAL_ROUTE_FAMILY_MIN) {
        const metaShare = route.games / Math.max(1, totalRouteGames)
        const posteriorShare =
          (familyGames + PRIOR_STRENGTH * metaShare) / (personalGames + PRIOR_STRENGTH)
        score += posteriorShare * 28
        personalAdjusted = posteriorShare > metaShare + 0.03
      }
    }

    return {
      route,
      core,
      score,
      personalAdjusted,
      damageAdjusted: Math.abs(balanceBoost) >= 2
    }
  })

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.route.games - a.route.games ||
      a.core.join(',').localeCompare(b.core.join(','))
  )
  const selected = scored[0]
  if (selected === undefined) return null
  const confidence = Math.min(
    0.98,
    0.35 + Math.min(0.35, selected.route.games / 40) + Math.min(0.28, meta.games / 350)
  )
  return {
    starterId: selected.route.starterId,
    core: selected.core,
    games: selected.route.games,
    wins: selected.route.wins,
    confidence,
    personalAdjusted: selected.personalAdjusted,
    damageAdjusted: selected.damageAdjusted
  }
}
