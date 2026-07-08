import type {
  ChampionStat,
  DurationBucketStat,
  FirstDragonStat,
  MatchupStat,
  PersonalCurve,
  StatsOverview,
  StreakInfo,
  WeekdayStat
} from '@shared/stats'
import type { AppDatabase } from './db'
import { MatchRepo, TimelineRepo, type ParticipantRow } from './db/repos'
import { SettingsRepo, SETTING_KEYS } from './db/repos/settings'
import { createTranslator, normalizeLocale } from '@shared/i18n'
import {
  computeWeaknesses,
  extractWeaknessEvents,
  type WeaknessGameInput
} from './stats-weaknesses'

/** New play session starts after this pause between games. */
const SESSION_GAP_MS = 45 * 60 * 1000
/** Duration buckets (seconds): corta < 25 min, media 25-32, larga > 32. */
const SHORT_S = 25 * 60
const LONG_S = 32 * 60
const MATCHUP_MIN_GAMES = 2
const OVERVIEW_LIMIT = 500

interface TimelineFrameLike {
  participantFrames?: Record<
    string,
    { totalGold?: number; minionsKilled?: number; jungleMinionsKilled?: number }
  >
  events?: { type?: string; monsterType?: string; killerId?: number }[]
}

interface TimelineLike {
  metadata?: { participants?: string[] }
  info?: { frames?: TimelineFrameLike[] }
}

function pct(wins: number, games: number): number {
  return games > 0 ? (wins / games) * 100 : 0
}

/**
 * Read-side personal statistics over the stored match history. Everything is
 * computed lazily and cached; `invalidate()` after new matches land.
 * Timelines are consumed as stored raw JSON (already zod-validated at
 * ingestion) with defensive access, matching the WP-003 read policy.
 */
export class StatsService {
  private readonly matches: MatchRepo
  private readonly timelines: TimelineRepo
  private readonly settings: SettingsRepo
  private overviewCache = new Map<string, { newestMatchId: string; value: StatsOverview }>()
  private curveCache = new Map<string, PersonalCurve | null>()

  constructor(db: AppDatabase) {
    this.matches = new MatchRepo(db)
    this.timelines = new TimelineRepo(db)
    this.settings = new SettingsRepo(db)
  }

  invalidate(): void {
    this.overviewCache.clear()
    this.curveCache.clear()
  }

  overview(puuid: string): StatsOverview {
    const rows = this.matches.ownerMatches(puuid, { limit: OVERVIEW_LIMIT })
    // Row fetch is cheap (no raw JSON); self-invalidate when history moved so
    // manual syncs are covered without extra wiring.
    const newestMatchId = rows[0]?.match.matchId ?? ''
    const cached = this.overviewCache.get(puuid)
    if (cached && cached.newestMatchId === newestMatchId && cached.value.totalGames === rows.length) {
      return cached.value
    }
    this.curveCache.clear()
    const champions = this.championStats(rows)
    const streaks = this.streaks(rows)
    const durations = this.durations(rows)
    const firstDragon = this.firstDragon(puuid, rows)
    const { worst, best } = this.matchups(puuid, rows)
    const weekdays = this.weekdays(rows)

    const overview: StatsOverview = {
      totalGames: rows.length,
      champions,
      streaks,
      durations,
      firstDragon,
      worstMatchups: worst,
      bestMatchups: best,
      weekdays,
      weaknesses: computeWeaknesses(
        this.weaknessInputs(puuid, rows),
        createTranslator(normalizeLocale(this.settings.get(SETTING_KEYS.locale)))
      )
    }
    this.overviewCache.set(puuid, { newestMatchId, value: overview })
    return overview
  }

  /** Personal CS/gold laning baseline for one champion, from stored timelines. */
  curve(puuid: string, champion: string): PersonalCurve | null {
    const key = `${puuid}:${champion}`
    if (this.curveCache.has(key)) return this.curveCache.get(key) ?? null

    const rows = this.matches
      .ownerMatches(puuid, { champion, limit: OVERVIEW_LIMIT })
      .filter(({ match }) => match.durationS >= 15 * 60)
    let games = 0
    const sums = { csAt10: 0, csAt15: 0, goldAt10: 0, goldAt15: 0 }
    for (const { match } of rows) {
      const timeline = this.timelines.getTimelineRaw(match.matchId) as TimelineLike | null
      if (!timeline) continue
      const index = timeline.metadata?.participants?.indexOf(puuid) ?? -1
      if (index < 0) continue
      const frames = timeline.info?.frames ?? []
      const at = (minute: number): { cs: number; gold: number } | null => {
        const frame = frames[minute]?.participantFrames?.[String(index + 1)]
        if (!frame) return null
        return {
          cs: (frame.minionsKilled ?? 0) + (frame.jungleMinionsKilled ?? 0),
          gold: frame.totalGold ?? 0
        }
      }
      const at10 = at(10)
      const at15 = at(15)
      if (!at10 || !at15) continue
      games += 1
      sums.csAt10 += at10.cs
      sums.csAt15 += at15.cs
      sums.goldAt10 += at10.gold
      sums.goldAt15 += at15.gold
    }

    const curve: PersonalCurve | null =
      games >= 2
        ? {
            champion,
            games,
            csAt10: sums.csAt10 / games,
            csAt15: sums.csAt15 / games,
            goldAt10: sums.goldAt10 / games,
            goldAt15: sums.goldAt15 / games
          }
        : null
    this.curveCache.set(key, curve)
    return curve
  }

  private championStats(
    rows: { match: { matchId: string; durationS: number }; own: ParticipantRow }[]
  ): ChampionStat[] {
    interface Acc {
      games: number
      wins: number
      kda: number
      csPerMin: number
      goldPerMin: number
      damageShare: number
      damageShareGames: number
      visionPerMin: number
      deaths: number
      vision: number
    }
    const byChampion = new Map<string, Acc>()
    for (const { match, own } of rows) {
      const acc = byChampion.get(own.champion) ?? {
        games: 0,
        wins: 0,
        kda: 0,
        csPerMin: 0,
        goldPerMin: 0,
        damageShare: 0,
        damageShareGames: 0,
        visionPerMin: 0,
        deaths: 0,
        vision: 0
      }
      const minutes = match.durationS / 60
      acc.games += 1
      if (own.win) acc.wins += 1
      acc.kda += (own.kills + own.assists) / Math.max(1, own.deaths)
      acc.deaths += own.deaths
      acc.vision += own.vision
      if (minutes > 0) {
        acc.csPerMin += own.cs / minutes
        acc.goldPerMin += own.gold / minutes
        acc.visionPerMin += own.vision / minutes
      }
      const team = this.matches
        .getParticipants(match.matchId)
        .filter((participant) => participant.win === own.win)
      const teamDamage = team.reduce((sum, participant) => sum + participant.damage, 0)
      if (teamDamage > 0) {
        acc.damageShare += (own.damage / teamDamage) * 100
        acc.damageShareGames += 1
      }
      byChampion.set(own.champion, acc)
    }
    return [...byChampion.entries()]
      .map(([champion, acc]) => ({
        champion,
        games: acc.games,
        winratePct: pct(acc.wins, acc.games),
        kda: acc.kda / acc.games,
        csPerMin: acc.csPerMin / acc.games,
        goldPerMin: acc.goldPerMin / acc.games,
        damageSharePct: acc.damageShareGames > 0 ? acc.damageShare / acc.damageShareGames : 0,
        visionPerMin: acc.visionPerMin / acc.games,
        deathsPerGame: acc.deaths / acc.games,
        visionPerGame: acc.vision / acc.games
      }))
      .sort((a, b) => b.games - a.games)
  }

  private streaks(
    rows: { match: { gameCreation: number }; own: ParticipantRow }[]
  ): StreakInfo {
    // Chronological order (ownerMatches returns newest first).
    const chronological = [...rows].sort((a, b) => a.match.gameCreation - b.match.gameCreation)

    let current = 0
    let longestWin = 0
    let longestLoss = 0
    let run = 0
    let runIsWin = false
    for (const { own } of chronological) {
      if (run === 0 || own.win !== runIsWin) {
        run = 1
        runIsWin = own.win
      } else {
        run += 1
      }
      if (runIsWin) longestWin = Math.max(longestWin, run)
      else longestLoss = Math.max(longestLoss, run)
    }
    if (chronological.length > 0) current = runIsWin ? run : -run

    // Session position: games 1-2 vs 3+ within a session (gap > 45 min).
    let sessionIndex = 0
    let previousCreation = 0
    const firstBucket = { games: 0, wins: 0 }
    const laterBucket = { games: 0, wins: 0 }
    for (const { match, own } of chronological) {
      sessionIndex = match.gameCreation - previousCreation > SESSION_GAP_MS ? 1 : sessionIndex + 1
      previousCreation = match.gameCreation
      const bucket = sessionIndex <= 2 ? firstBucket : laterBucket
      bucket.games += 1
      if (own.win) bucket.wins += 1
    }

    return {
      current,
      longestWin,
      longestLoss,
      sessionFirstWrPct: firstBucket.games > 0 ? pct(firstBucket.wins, firstBucket.games) : null,
      sessionLaterWrPct: laterBucket.games > 0 ? pct(laterBucket.wins, laterBucket.games) : null,
      sessionLaterGames: laterBucket.games
    }
  }

  private durations(
    rows: { match: { durationS: number }; own: ParticipantRow }[]
  ): DurationBucketStat[] {
    const buckets: Record<'corta' | 'media' | 'larga', { games: number; wins: number }> = {
      corta: { games: 0, wins: 0 },
      media: { games: 0, wins: 0 },
      larga: { games: 0, wins: 0 }
    }
    for (const { match, own } of rows) {
      const bucket =
        match.durationS < SHORT_S ? buckets.corta : match.durationS <= LONG_S ? buckets.media : buckets.larga
      bucket.games += 1
      if (own.win) bucket.wins += 1
    }
    return (['corta', 'media', 'larga'] as const).map((bucket) => ({
      bucket,
      games: buckets[bucket].games,
      winratePct: pct(buckets[bucket].wins, buckets[bucket].games)
    }))
  }

  private firstDragon(
    puuid: string,
    rows: { match: { matchId: string }; own: ParticipantRow }[]
  ): FirstDragonStat | null {
    const withDragon = { games: 0, wins: 0 }
    const withoutDragon = { games: 0, wins: 0 }
    for (const { match, own } of rows) {
      const timeline = this.timelines.getTimelineRaw(match.matchId) as TimelineLike | null
      if (!timeline) continue
      const participants = timeline.metadata?.participants ?? []
      const ownId = participants.indexOf(puuid) + 1
      if (ownId === 0) continue
      let firstKillerId: number | null = null
      outer: for (const frame of timeline.info?.frames ?? []) {
        for (const event of frame.events ?? []) {
          if (event.type === 'ELITE_MONSTER_KILL' && event.monsterType === 'DRAGON') {
            firstKillerId = event.killerId ?? null
            break outer
          }
        }
      }
      if (firstKillerId === null) continue
      const killerPuuid = participants[firstKillerId - 1]
      const killer = this.matches
        .getParticipants(match.matchId)
        .find((participant) => participant.puuid === killerPuuid)
      if (!killer) continue
      const ownTeamTookIt = killer.win === own.win
      const bucket = ownTeamTookIt ? withDragon : withoutDragon
      bucket.games += 1
      if (own.win) bucket.wins += 1
    }
    if (withDragon.games + withoutDragon.games === 0) return null
    return {
      withGames: withDragon.games,
      withWrPct: pct(withDragon.wins, withDragon.games),
      withoutGames: withoutDragon.games,
      withoutWrPct: pct(withoutDragon.wins, withoutDragon.games)
    }
  }

  private matchups(
    puuid: string,
    rows: { match: { matchId: string }; own: ParticipantRow }[]
  ): { worst: MatchupStat[]; best: MatchupStat[] } {
    const byEnemy = new Map<string, { role: string; games: number; wins: number }>()
    for (const { match, own } of rows) {
      if (own.role === '') continue
      const rival = this.matches
        .getParticipants(match.matchId)
        .find(
          (participant) =>
            participant.puuid !== puuid &&
            participant.win !== own.win &&
            participant.role === own.role
        )
      if (!rival) continue
      const entry = byEnemy.get(rival.champion) ?? { role: own.role, games: 0, wins: 0 }
      entry.games += 1
      if (own.win) entry.wins += 1
      byEnemy.set(rival.champion, entry)
    }
    const qualified = [...byEnemy.entries()]
      .filter(([, entry]) => entry.games >= MATCHUP_MIN_GAMES)
      .map(([enemyChampion, entry]) => ({
        enemyChampion,
        role: entry.role,
        games: entry.games,
        winratePct: pct(entry.wins, entry.games)
      }))
    const byWinrate = [...qualified].sort((a, b) => a.winratePct - b.winratePct)
    return { worst: byWinrate.slice(0, 5), best: byWinrate.slice(-5).reverse() }
  }

  /** Per-game inputs for the weakness detectors (WP-016). */
  private weaknessInputs(
    puuid: string,
    rows: { match: { matchId: string; durationS: number }; own: ParticipantRow }[]
  ): WeaknessGameInput[] {
    return rows.map(({ match, own }) => {
      const participants = this.matches.getParticipants(match.matchId)
      const teamKills = participants
        .filter((participant) => participant.win === own.win)
        .reduce((sum, participant) => sum + participant.kills, 0)
      const input: WeaknessGameInput = {
        durationS: match.durationS,
        role: own.role,
        win: own.win,
        kills: own.kills,
        deaths: own.deaths,
        assists: own.assists,
        vision: own.vision,
        teamKills
      }

      const timeline = this.timelines.getTimelineRaw(match.matchId) as
        | (Parameters<typeof extractWeaknessEvents>[0] & {
            metadata?: { participants?: string[] }
          })
        | null
      if (!timeline) return input
      const timelineParticipants = timeline.metadata?.participants ?? []
      const ownParticipantId = timelineParticipants.indexOf(puuid) + 1
      if (ownParticipantId === 0) return input

      const enemyParticipantIds = new Set<number>()
      const enemyJunglerIds = new Set<number>()
      for (const participant of participants) {
        if (participant.win === own.win) continue
        const id = timelineParticipants.indexOf(participant.puuid) + 1
        if (id === 0) continue
        enemyParticipantIds.add(id)
        if (participant.role === 'JUNGLE') enemyJunglerIds.add(id)
      }
      const events = extractWeaknessEvents(timeline, {
        ownParticipantId,
        enemyParticipantIds,
        enemyJunglerIds
      })
      return { ...input, ...events }
    })
  }

  private weekdays(
    rows: { match: { gameCreation: number }; own: ParticipantRow }[]
  ): WeekdayStat[] {
    const days = Array.from({ length: 7 }, () => ({ games: 0, wins: 0 }))
    for (const { match, own } of rows) {
      const day = days[new Date(match.gameCreation).getDay()]
      if (!day) continue
      day.games += 1
      if (own.win) day.wins += 1
    }
    return days.map((day, weekday) => ({
      weekday,
      games: day.games,
      winratePct: pct(day.wins, day.games)
    }))
  }
}
