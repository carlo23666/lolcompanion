/** Payloads for the Historial view (WP-010). */

export interface HistoryRow {
  matchId: string
  champion: string
  role: string
  kills: number
  deaths: number
  assists: number
  csPerMin: number
  win: boolean
  durationS: number
  patch: string
  gameCreation: number
  queueId: number
}

export interface HistoryAggregate {
  champion: string
  games: number
  winratePct: number
  csPerMin: number
}

export interface HistoryDetail {
  matchId: string
  champion: string
  role: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  gold: number
  damage: number
  vision: number
  durationS: number
  patch: string
  items: number[]
  goldCurve: number[]
  /** Same-lane enemy champion (ddragon id), when derivable. */
  laneOpponent: string | null
  /** Master+ final-build distribution for this champion+role (crawled meta);
   * falls back to the newest crawled patch when the match patch has none. */
  metaBuild: {
    patch: string
    games: number
    items: { itemId: number; games: number; wins: number }[]
  } | null
}
