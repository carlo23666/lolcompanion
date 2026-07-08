import type { WeaknessInsight } from '@shared/stats'
import { t as translators, type Translator } from '@shared/i18n'

/**
 * Weakness detectors over the stored history (WP-016): turn the numbers into
 * explicit, actionable weak points. Pure and synchronous — StatsService
 * prepares the inputs. Every threshold documents WHY, engine-THRESHOLDS style.
 */
export const WEAKNESS_THRESHOLDS = {
  /** Below this many games any verdict is noise. */
  MIN_GAMES: 8,
  /** Timeline-based detectors need this many games WITH stored timelines. */
  MIN_TIMELINE_GAMES: 5,

  /** Laning phase ends ~min 14 (tower plates). */
  EARLY_END_MS: 14 * 60_000,
  /** Mid game ends ~min 25 (baron becomes the play). */
  MID_END_MS: 25 * 60_000,
  /**
   * Avg deaths per game inside a phase that flag it. Early is strictest:
   * 2 lane deaths/game on average means the lane bleeds every single game.
   */
  PHASE_DEATHS: { early: 2, mid: 2.5, late: 2.5 },

  /**
   * Early deaths involving the enemy jungler per game. 0.8 ≈ ganked to death
   * in 4 of every 5 games — warding/positioning issue, not variance.
   */
  GANKED_PER_GAME: 0.8,

  /**
   * Vision score per minute floor by role. Supports live off vision (~1.4
   * is average at Emerald+); junglers sweep and deep-ward; laners at least
   * keep river trinkets on cooldown.
   */
  VISION_PER_MIN: { UTILITY: 1.0, JUNGLE: 0.55, DEFAULT: 0.3 } as Record<string, number>,

  /** An objective falling this soon after your death counts as conceded by it. */
  OBJECTIVE_AFTER_DEATH_MS: 45_000,
  /** Share of enemy elite objectives conceded off your deaths that flags. */
  OBJECTIVES_WHILE_DEAD_SHARE: 0.25,

  /**
   * (K+A)/team-kills floor. Under 40% of your team's kills means the game
   * happens away from you regardless of role.
   */
  KILL_PARTICIPATION: 0.4,

  /** severity high = this factor past the threshold. */
  HIGH_FACTOR: 1.35
} as const

export interface WeaknessGameInput {
  durationS: number
  role: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  vision: number
  teamKills: number
  /** From the stored timeline; undefined when none exists for the match. */
  ownDeaths?: { ts: number; enemyJunglerInvolved: boolean }[]
  enemyEliteKills?: { ts: number }[]
}

const T = WEAKNESS_THRESHOLDS

function severityFor(value: number, threshold: number): 'high' | 'medium' {
  return value >= threshold * T.HIGH_FACTOR ? 'high' : 'medium'
}

function dominantRole(games: WeaknessGameInput[]): string {
  const counts = new Map<string, number>()
  for (const game of games) counts.set(game.role, (counts.get(game.role) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

/** One decimal for human-facing numbers. */
function fmt(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1)
}

export function computeWeaknesses(
  games: WeaknessGameInput[],
  t: Translator = translators.es
): WeaknessInsight[] {
  if (games.length < T.MIN_GAMES) return []
  const insights: WeaknessInsight[] = []

  // --- Timeline-backed detectors ---
  const withTimeline = games.filter((game) => game.ownDeaths !== undefined)
  if (withTimeline.length >= T.MIN_TIMELINE_GAMES) {
    const phases = { early: 0, mid: 0, late: 0 }
    let lateGames = 0
    let gankedDeaths = 0
    let concededObjectives = 0
    let enemyObjectives = 0
    for (const game of withTimeline) {
      if (game.durationS * 1000 > T.MID_END_MS) lateGames += 1
      for (const death of game.ownDeaths ?? []) {
        if (death.ts < T.EARLY_END_MS) {
          phases.early += 1
          if (death.enemyJunglerInvolved) gankedDeaths += 1
        } else if (death.ts < T.MID_END_MS) phases.mid += 1
        else phases.late += 1
      }
      for (const objective of game.enemyEliteKills ?? []) {
        enemyObjectives += 1
        const conceded = (game.ownDeaths ?? []).some(
          (death) => objective.ts - death.ts >= 0 && objective.ts - death.ts <= T.OBJECTIVE_AFTER_DEATH_MS
        )
        if (conceded) concededObjectives += 1
      }
    }

    const phaseDefs = [
      {
        key: 'deaths-early' as const,
        avg: phases.early / withTimeline.length,
        threshold: T.PHASE_DEATHS.early,
        findingKey: 'weakness.deaths.early.finding' as const,
        adviceKey: 'weakness.deaths.early.advice' as const
      },
      {
        key: 'deaths-mid' as const,
        avg: phases.mid / withTimeline.length,
        threshold: T.PHASE_DEATHS.mid,
        findingKey: 'weakness.deaths.mid.finding' as const,
        adviceKey: 'weakness.deaths.mid.advice' as const
      },
      {
        key: 'deaths-late' as const,
        avg: lateGames > 0 ? phases.late / lateGames : 0,
        threshold: T.PHASE_DEATHS.late,
        findingKey: 'weakness.deaths.late.finding' as const,
        adviceKey: 'weakness.deaths.late.advice' as const
      }
    ]
    for (const phase of phaseDefs) {
      if (phase.avg >= phase.threshold) {
        insights.push({
          key: phase.key,
          severity: severityFor(phase.avg, phase.threshold),
          finding: t(phase.findingKey, { avg: fmt(phase.avg) }),
          advice: t(phase.adviceKey),
          games: withTimeline.length
        })
      }
    }

    const gankedPerGame = gankedDeaths / withTimeline.length
    if (gankedPerGame >= T.GANKED_PER_GAME) {
      insights.push({
        key: 'gankable',
        severity: severityFor(gankedPerGame, T.GANKED_PER_GAME),
        finding: t('weakness.gankable.finding', { avg: fmt(gankedPerGame) }),
        advice: t('weakness.gankable.advice'),
        games: withTimeline.length
      })
    }

    if (enemyObjectives > 0) {
      const share = concededObjectives / enemyObjectives
      if (share >= T.OBJECTIVES_WHILE_DEAD_SHARE) {
        insights.push({
          key: 'objectives-while-dead',
          severity: severityFor(share, T.OBJECTIVES_WHILE_DEAD_SHARE),
          finding: t('weakness.objectives.finding', { pct: String(Math.round(share * 100)) }),
          advice: t('weakness.objectives.advice'),
          games: withTimeline.length
        })
      }
    }
  }

  // --- Scalar detectors (no timeline needed) ---
  const role = dominantRole(games)
  const visionPerMin =
    games.reduce((sum, game) => sum + game.vision / Math.max(1, game.durationS / 60), 0) /
    games.length
  const visionFloor = T.VISION_PER_MIN[role] ?? T.VISION_PER_MIN['DEFAULT'] ?? 0.3
  if (visionPerMin < visionFloor) {
    // Inverted metric: severity by how far BELOW the floor.
    const deficit = visionFloor / Math.max(0.01, visionPerMin)
    insights.push({
      key: 'low-vision',
      severity: deficit >= T.HIGH_FACTOR ? 'high' : 'medium',
      finding: t('weakness.vision.finding', {
        vision: visionPerMin.toFixed(2),
        floor: visionFloor.toFixed(2)
      }),
      advice: t('weakness.vision.advice'),
      games: games.length
    })
  }

  const participationGames = games.filter((game) => game.teamKills > 0)
  if (participationGames.length >= T.MIN_GAMES) {
    const participation =
      participationGames.reduce(
        (sum, game) => sum + (game.kills + game.assists) / game.teamKills,
        0
      ) / participationGames.length
    if (participation < T.KILL_PARTICIPATION) {
      const deficit = T.KILL_PARTICIPATION / Math.max(0.01, participation)
      insights.push({
        key: 'low-kill-participation',
        severity: deficit >= T.HIGH_FACTOR ? 'high' : 'medium',
        finding: t('weakness.participation.finding', {
          pct: String(Math.round(participation * 100)),
          floor: String(Math.round(T.KILL_PARTICIPATION * 100))
        }),
        advice: t('weakness.participation.advice'),
        games: participationGames.length
      })
    }
  }

  const order = { high: 0, medium: 1 }
  return insights.sort((a, b) => order[a.severity] - order[b.severity])
}

/** Defensive timeline shapes (WP-003 read policy: stored raw, validated at ingest). */
interface TimelineEventLike {
  type?: string
  timestamp?: number
  killerId?: number
  victimId?: number
  assistingParticipantIds?: number[]
}
interface TimelineLike {
  info?: { frames?: { events?: TimelineEventLike[] }[] }
}

export interface WeaknessEvents {
  ownDeaths: { ts: number; enemyJunglerInvolved: boolean }[]
  enemyEliteKills: { ts: number }[]
}

/** Pulls the death/objective events one game contributes to the detectors. */
export function extractWeaknessEvents(
  timeline: TimelineLike,
  ids: {
    ownParticipantId: number
    enemyParticipantIds: Set<number>
    enemyJunglerIds: Set<number>
  }
): WeaknessEvents {
  const events: WeaknessEvents = { ownDeaths: [], enemyEliteKills: [] }
  for (const frame of timeline.info?.frames ?? []) {
    for (const event of frame.events ?? []) {
      const ts = event.timestamp ?? 0
      if (event.type === 'CHAMPION_KILL' && event.victimId === ids.ownParticipantId) {
        const involved =
          (event.killerId !== undefined && ids.enemyJunglerIds.has(event.killerId)) ||
          (event.assistingParticipantIds ?? []).some((id) => ids.enemyJunglerIds.has(id))
        events.ownDeaths.push({ ts, enemyJunglerInvolved: involved })
      }
      if (
        event.type === 'ELITE_MONSTER_KILL' &&
        event.killerId !== undefined &&
        ids.enemyParticipantIds.has(event.killerId)
      ) {
        events.enemyEliteKills.push({ ts })
      }
    }
  }
  return events
}
