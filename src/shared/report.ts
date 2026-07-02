/** Post-game report: the finished match vs the owner's personal averages. */

export interface RecommendedItemOutcome {
  itemId: number
  itemName: string | null
  /** True when the item (exact id) is in the final build. */
  followed: boolean
}

export interface PostGameReport {
  matchId: string
  champion: string
  win: boolean
  durationS: number
  kills: number
  deaths: number
  assists: number
  csPerMin: number
  goldPerMin: number
  damageSharePct: number
  /** Personal averages on this champion (null when not enough history). */
  avgCsPerMin: number | null
  avgGoldPerMin: number | null
  avgDamageSharePct: number | null
  /** Distinct items the engine recommended during the game, with outcome. */
  recommendedItems: RecommendedItemOutcome[]
}
