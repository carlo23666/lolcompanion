/**
 * Master+ item aggregates for the OWN champion+role — the PRIMARY signal of
 * the recommendation engine since 2026-07-07 (owner: "rely on Master+ games
 * mostly, logic only adjusts"). The caller does the DB lookup (the engine
 * stays pure); everything here is synchronous set math over that snapshot.
 */
export interface MetaItemStat {
  itemId: number
  games: number
  wins: number
  /** Completion-order stats from timelines (WP-015); absent until crawled. */
  orderGames?: number
  /** Sum of 1-based completion positions across orderGames. */
  slotSum?: number
  /** Games where this was the FIRST finished item. */
  firstGames?: number
}

/** Below this sample an item's average completion slot is noise. */
export const ORDER_MIN_GAMES = 3

/** Average completion position (1 = first item), or null without sample. */
export function avgCompletionSlot(stat: MetaItemStat): number | null {
  return stat.orderGames !== undefined && stat.slotSum !== undefined && stat.orderGames >= ORDER_MIN_GAMES
    ? stat.slotSum / stat.orderGames
    : null
}

export interface MetaItemsInput {
  /** Most-bought completed items, most games first (meta_champion_items). */
  items: MetaItemStat[]
  /** Aggregated games for the champion+role (sample-size gate). */
  games: number
}

/** Below this champion+role sample the meta build is noise. */
export const META_TRUST_MIN_GAMES = 20
/** Below this per-item sample an item is not "what Master+ builds". */
export const META_ITEM_MIN_GAMES = 5

/**
 * A rule suggestion that Master+ players do NOT back on this champion can
 * never outrank the meta build line — it ships capped and labeled.
 */
export const SUGGESTION_SCORE_CAP = 45

/** Enough sample to trust the champion's Master+ item distribution at all. */
export function metaTrusted(meta: MetaItemsInput | undefined): meta is MetaItemsInput {
  return meta !== undefined && meta.games >= META_TRUST_MIN_GAMES
}

export function metaUsage(
  meta: MetaItemsInput | undefined,
  itemId: number
): MetaItemStat | null {
  if (meta === undefined) return null
  const stat = meta.items.find((entry) => entry.itemId === itemId)
  return stat !== undefined && stat.games >= META_ITEM_MIN_GAMES ? stat : null
}

/** The candidate Master+ players actually build the most on this champion. */
export function metaPreferred(
  meta: MetaItemsInput | undefined,
  candidates: readonly number[]
): MetaItemStat | null {
  let best: MetaItemStat | null = null
  for (const id of candidates) {
    const stat = metaUsage(meta, id)
    if (stat !== null && (best === null || stat.games > best.games)) best = stat
  }
  return best
}

/**
 * Candidates reordered by Master+ usage on this champion (most games first,
 * unbacked candidates after, original relative order preserved).
 */
export function orderByMeta(
  candidates: readonly number[],
  meta: MetaItemsInput | undefined
): number[] {
  return [...candidates].sort((a, b) => {
    const gamesA = metaUsage(meta, a)?.games ?? 0
    const gamesB = metaUsage(meta, b)?.games ?? 0
    if (gamesA !== gamesB) return gamesB - gamesA
    return candidates.indexOf(a) - candidates.indexOf(b)
  })
}

export function metaPickReason(championName: string, itemName: string, stat: MetaItemStat): string {
  const wr = Math.round((stat.wins / stat.games) * 100)
  return `${itemName} es lo que compran los Master+ con ${championName} en este caso (${String(stat.games)} partidas, ${String(wr)}% WR)`
}

export function suggestionReason(championName: string): string {
  return `Pocos Master+ con ${championName} lo compran: sugerencia situacional, no prioridad`
}
