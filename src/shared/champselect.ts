/**
 * Champ select insights: derived ONLY from champions visible on the champ
 * select screen (picks/intents) + the owner's own baseline pool. No player
 * identities involved (Riot policy §2).
 */

export interface ChampionMeta {
  /** Data Dragon id, e.g. "MonkeyKing" — also the icon/splash file stem. */
  id: string
  /** Display name, e.g. "Wukong". */
  name: string
  damageType: 'physical' | 'magic' | 'mixed'
}

export interface TeamDamageSplit {
  physical: number
  magic: number
  mixed: number
  /** Champions counted (picked/intent only; 0 = nothing to say yet). */
  picked: number
}

export interface ChampSelectItemRef {
  id: number
  name: string
}

/** A champion the owner could pick, ranked from his own stored history. */
export interface PickSuggestion {
  /** Data Dragon id — also the portrait/splash file stem. */
  championId: string
  name: string
  games: number
  winratePct: number
  /** Spanish, concrete: winrate line + comp/pool notes. */
  reasons: string[]
}

export interface ChampSelectInsights {
  enemySplit: TeamDamageSplit
  allySplit: TeamDamageSplit
  /** Spanish, concrete, derived from the splits/healers. */
  tips: string[]
  /** What to pick, from the owner's own history (empty until he has one). */
  picks: PickSuggestion[]
  /** Owner's baseline plan for his picked champion (null if not in pool). */
  ownPlan: {
    championId: string
    role: string
    core: ChampSelectItemRef[]
    situational: ChampSelectItemRef[]
  } | null
}
