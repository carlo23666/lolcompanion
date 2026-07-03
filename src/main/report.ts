import type {
  PostGameReport,
  PostGameReportResult,
  RecommendedItemOutcome
} from '@shared/report'
import type { AppDatabase } from './db'
import { LiveSessionRepo, MatchRepo } from './db/repos'
import type { StatsService } from './stats'

const MAX_RECOMMENDED_ITEMS = 10
const MAX_SUMMARY_LINES = 4

/** Modes that never reach Riot match history — no report can exist for them. */
function isMatchmadeMode(gameMode: string | null): boolean {
  if (gameMode === null) return true // old rows predate the column
  return gameMode !== 'PRACTICETOOL' && !gameMode.startsWith('TUTORIAL')
}

/**
 * Spanish takeaways from the report numbers. Pure so tests can pin the
 * thresholds; every line states the numbers it's derived from.
 */
export function buildReportSummary(
  report: Pick<
    PostGameReport,
    | 'champion'
    | 'deaths'
    | 'avgDeaths'
    | 'visionScore'
    | 'avgVisionScore'
    | 'csPerMin'
    | 'avgCsPerMin'
    | 'damageSharePct'
    | 'avgDamageSharePct'
    | 'recommendedItems'
  >
): string[] {
  const lines: string[] = []

  if (report.avgDeaths !== null && report.avgDeaths > 0) {
    if (report.deaths >= report.avgDeaths + 2) {
      lines.push(
        `Has muerto ${String(report.deaths)} veces, por encima de tu media de ${report.avgDeaths.toFixed(1)} con ${report.champion} — revisa qué muertes eran evitables`
      )
    } else if (report.deaths <= report.avgDeaths - 1) {
      lines.push(
        `Solo ${String(report.deaths)} muertes (tu media: ${report.avgDeaths.toFixed(1)}) — buen control del riesgo`
      )
    }
  }

  if (report.avgVisionScore !== null && report.avgVisionScore > 0) {
    if (report.visionScore < report.avgVisionScore * 0.8) {
      lines.push(
        `Visión baja: ${String(Math.round(report.visionScore))} puntos frente a tu media de ${report.avgVisionScore.toFixed(0)} — compra algún pink más y usa el trinket al salir de base`
      )
    } else if (report.visionScore > report.avgVisionScore * 1.2) {
      lines.push(
        `Buena visión: ${String(Math.round(report.visionScore))} puntos frente a tu media de ${report.avgVisionScore.toFixed(0)}`
      )
    }
  }

  if (report.avgCsPerMin !== null && report.avgCsPerMin > 0) {
    if (report.csPerMin < report.avgCsPerMin * 0.85) {
      lines.push(
        `Farmeo flojo: ${report.csPerMin.toFixed(1)} CS/min frente a tu media de ${report.avgCsPerMin.toFixed(1)} — prioriza oleadas entre jugadas`
      )
    }
  }

  if (report.avgDamageSharePct !== null && report.avgDamageSharePct > 0) {
    if (report.damageSharePct > report.avgDamageSharePct * 1.2) {
      lines.push(
        `Has cargado con el daño del equipo: ${report.damageSharePct.toFixed(0)}% frente a tu media de ${report.avgDamageSharePct.toFixed(0)}%`
      )
    }
  }

  const total = report.recommendedItems.length
  if (total >= 3) {
    const followed = report.recommendedItems.filter((item) => item.followed).length
    const ratio = followed / total
    if (ratio >= 0.7) {
      lines.push(
        `Build consistente: has seguido ${String(followed)} de ${String(total)} recomendaciones del motor`
      )
    } else if (ratio < 0.4) {
      lines.push(
        `Solo has seguido ${String(followed)} de ${String(total)} recomendaciones del motor — compara tu build final con las sugerencias de abajo`
      )
    }
  }

  return lines.slice(0, MAX_SUMMARY_LINES)
}

/**
 * Builds the post-game report for the most recent live session that got
 * linked to a stored match (WP-010 linking): final stats vs the owner's
 * personal averages on that champion, plus which engine recommendations the
 * owner actually bought. If the newest session is a non-matchmade mode
 * (Practice Tool), reports that instead of falling back to an older game.
 */
export class ReportService {
  private readonly sessions: LiveSessionRepo
  private readonly matches: MatchRepo

  constructor(
    db: AppDatabase,
    private readonly stats: StatsService
  ) {
    this.sessions = new LiveSessionRepo(db)
    this.matches = new MatchRepo(db)
  }

  lastReport(puuid: string): PostGameReportResult | null {
    const recent = this.sessions.latestSessions(10)
    const newest = recent[0]
    if (newest && !isMatchmadeMode(newest.gameMode)) {
      return { kind: 'unsupported', gameMode: newest.gameMode ?? '' }
    }

    const session = recent.find(
      (candidate) => candidate.matchId !== null && candidate.matchId !== ''
    )
    if (!session || session.matchId === null) return null

    const match = this.matches.getMatch(session.matchId)
    if (!match) return null
    const participants = this.matches.getParticipants(session.matchId)
    const own = participants.find((participant) => participant.puuid === puuid)
    if (!own) return null

    const minutes = match.durationS / 60
    const teamDamage = participants
      .filter((participant) => participant.win === own.win)
      .reduce((sum, participant) => sum + participant.damage, 0)

    const averages = this.stats
      .overview(puuid)
      .champions.find((stat) => stat.champion === own.champion)

    const finalItems = new Set(own.items.slice(0, 6).filter((id) => id > 0))
    const recommendedItems = this.recommendedItems(session.id, finalItems)

    const report: PostGameReport = {
      matchId: session.matchId,
      champion: own.champion,
      win: own.win,
      durationS: match.durationS,
      kills: own.kills,
      deaths: own.deaths,
      assists: own.assists,
      csPerMin: minutes > 0 ? own.cs / minutes : 0,
      goldPerMin: minutes > 0 ? own.gold / minutes : 0,
      damageSharePct: teamDamage > 0 ? (own.damage / teamDamage) * 100 : 0,
      visionScore: own.vision,
      // Averages include this match too — acceptable v1 bias, noted in docs.
      avgCsPerMin: averages?.csPerMin ?? null,
      avgGoldPerMin: averages?.goldPerMin ?? null,
      avgDamageSharePct: averages?.damageSharePct ?? null,
      avgDeaths: averages?.deathsPerGame ?? null,
      avgVisionScore: averages?.visionPerGame ?? null,
      recommendedItems,
      summary: []
    }
    report.summary = buildReportSummary(report)
    return { kind: 'report', report }
  }

  private recommendedItems(
    sessionId: number,
    finalItems: Set<number>
  ): RecommendedItemOutcome[] {
    const outcomes = new Map<number, RecommendedItemOutcome>()
    for (const entry of this.sessions.getRecommendations(sessionId)) {
      if (!Array.isArray(entry.recommendations)) continue
      for (const recommendation of entry.recommendations as {
        itemId?: number | null
        itemName?: string | null
      }[]) {
        const itemId = recommendation.itemId
        if (typeof itemId !== 'number' || outcomes.has(itemId)) continue
        outcomes.set(itemId, {
          itemId,
          itemName: recommendation.itemName ?? null,
          followed: finalItems.has(itemId)
        })
      }
    }
    return [...outcomes.values()].slice(0, MAX_RECOMMENDED_ITEMS)
  }
}
