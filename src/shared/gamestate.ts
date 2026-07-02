/**
 * The single normalized model the rules engine consumes.
 * Connectors map INTO it (src/main/engine/normalize.ts), the engine reads
 * FROM it. Everything here must be derivable from on-screen-visible
 * information (Riot policy).
 */

export type DamageType = 'physical' | 'magic' | 'mixed'

export interface GameStateItem {
  id: number
  name: string
  totalGold: number
  /** True when the item has no further upgrades (finished/legendary). */
  isCompleted: boolean
  tags: string[]
  stats: Record<string, number>
}

export interface PlayerScores {
  kills: number
  deaths: number
  assists: number
  creepScore: number
  wardScore: number
}

export interface EstimatedCombatStats {
  hp: number
  armor: number
  magicResist: number
  attackDamage: number
}

export interface PlayerState {
  /** Data Dragon champion id, e.g. "MonkeyKing". Empty if unresolved. */
  championId: string
  /** Display name from the Live Client, e.g. "Wukong". */
  championName: string
  team: 'ORDER' | 'CHAOS'
  level: number
  position: string
  isDead: boolean
  respawnTimer: number
  scores: PlayerScores
  items: GameStateItem[]
  damageType: DamageType
  /**
   * Total gold earned estimate (see GOLD MODEL in normalize.ts).
   * For `self` this is complemented by the exact `currentGold`.
   */
  estimatedGoldEarned: number
  /** Base+growth (+ visible item bonuses) — an estimate for enemies. */
  estimatedStats: EstimatedCombatStats
}

export interface SelfState extends PlayerState {
  /** Exact, from the Live Client active player. */
  currentGold: number
  /** Exact current stats from the Live Client (post-items/runes). */
  stats: {
    abilityPower: number
    attackDamage: number
    armor: number
    magicResist: number
    currentHealth: number
    maxHealth: number
    attackSpeed: number
    critChance: number
    moveSpeed: number
  }
  runeIds: number[]
}

export interface TeamAggregates {
  /** Estimated share of the team's damage that is physical, 0..1. */
  physicalShare: number
  /** Estimated share that is magic, 0..1 (rest of 1 after true damage ~0). */
  magicShare: number
  /** Average effective HP vs a mixed attacker (see normalize.ts). */
  tankinessIndex: number
  /** Weighted count of healing/shielding sources (champs + items). */
  healingIndex: number
  estimatedTotalGold: number
}

export interface ObjectivesState {
  /** Dragon subtypes taken, per team (e.g. ["FIRE", "OCEAN"]). */
  dragons: { ORDER: string[]; CHAOS: string[] }
  barons: { ORDER: number; CHAOS: number }
  heralds: { ORDER: number; CHAOS: number }
  /** Enemy towers destroyed BY each team. */
  towers: { ORDER: number; CHAOS: number }
}

export interface GameState {
  gameTimeS: number
  patch: string
  gameMode: string
  self: SelfState
  /** Own team WITHOUT self (4 players in a normal game). */
  allies: PlayerState[]
  enemies: PlayerState[]
  objectives: ObjectivesState
  allyAggregates: TeamAggregates
  enemyAggregates: TeamAggregates
}

/** Semantic events between two consecutive GameStates (diff engine). */
export type GameStateEvent =
  | { type: 'itemCompleted'; championName: string; team: 'ORDER' | 'CHAOS'; item: GameStateItem }
  | { type: 'levelUp'; championName: string; team: 'ORDER' | 'CHAOS'; level: number }
  | { type: 'playerDied'; championName: string; team: 'ORDER' | 'CHAOS' }
  | { type: 'playerRespawned'; championName: string; team: 'ORDER' | 'CHAOS' }
  | {
      type: 'objectiveTaken'
      team: 'ORDER' | 'CHAOS'
      objective: 'dragon' | 'baron' | 'herald' | 'tower'
      detail?: string
    }
