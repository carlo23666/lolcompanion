export type MaterialAdvantageKind =
  'levels' | 'completedItems' | 'itemValue' | 'health' | 'cs' | 'kda'

export interface MaterialAdvantageReason {
  kind: MaterialAdvantageKind
  amount: number
}

/** Conservative 1v1 hint derived exclusively from visible scoreboard state. */
export interface MaterialAdvantageSignal {
  gameTimeS: number
  opponentChampionName: string
  score: number
  advantages: MaterialAdvantageReason[]
}
