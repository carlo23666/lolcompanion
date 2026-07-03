/** Post-game report: the finished match vs the owner's personal averages. */

/**
 * Result wrapper: some game modes (Practice Tool, tutorial) never reach Riot
 * match history, so no report can exist for them — the UI must say so
 * instead of silently showing an older game.
 */
export type PostGameReportResult =
  | { kind: 'report'; report: PostGameReport }
  | { kind: 'unsupported'; gameMode: string }

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
  visionScore: number
  /** Personal averages on this champion (null when not enough history). */
  avgCsPerMin: number | null
  avgGoldPerMin: number | null
  avgDamageSharePct: number | null
  avgDeaths: number | null
  avgVisionScore: number | null
  /** Distinct items the engine recommended during the game, with outcome. */
  recommendedItems: RecommendedItemOutcome[]
  /** Short Spanish takeaways derived from the numbers above. */
  summary: string[]
}
