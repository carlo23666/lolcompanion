/** Payloads for the personal statistics view (owner-only, computed from stored matches). */

export interface ChampionStat {
  champion: string
  games: number
  winratePct: number
  /** (kills + assists) / max(1, deaths), averaged per game. */
  kda: number
  csPerMin: number
  goldPerMin: number
  /** Owner damage as % of his team's total damage, averaged per game. */
  damageSharePct: number
  visionPerMin: number
  deathsPerGame: number
  /** Raw vision score averaged per game (report card comparisons). */
  visionPerGame: number
}

/** Personal laning baseline per champion, from stored timelines. */
export interface PersonalCurve {
  champion: string
  games: number
  csAt10: number
  csAt15: number
  goldAt10: number
  goldAt15: number
}

export interface StreakInfo {
  /** Positive = current win streak, negative = current loss streak. */
  current: number
  longestWin: number
  longestLoss: number
  /** Winrate in games 1-2 of a play session vs game 3+ (tilt indicator). */
  sessionFirstWrPct: number | null
  sessionLaterWrPct: number | null
  sessionLaterGames: number
}

export interface DurationBucketStat {
  /** corta < 25 min, media 25-32, larga > 32. */
  bucket: 'corta' | 'media' | 'larga'
  games: number
  winratePct: number
}

export interface FirstDragonStat {
  withGames: number
  withWrPct: number
  withoutGames: number
  withoutWrPct: number
}

export interface MatchupStat {
  enemyChampion: string
  role: string
  games: number
  winratePct: number
}

export interface WeekdayStat {
  /** 0 = domingo … 6 = sábado (Date.getDay()). */
  weekday: number
  games: number
  winratePct: number
}

export interface StatsOverview {
  totalGames: number
  champions: ChampionStat[]
  streaks: StreakInfo
  durations: DurationBucketStat[]
  /** null while no timelines are stored. */
  firstDragon: FirstDragonStat | null
  /** Same-role enemies faced ≥2 times, worst winrate first. */
  worstMatchups: MatchupStat[]
  bestMatchups: MatchupStat[]
  weekdays: WeekdayStat[]
}
