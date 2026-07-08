import type {
  PostGameReport,
  PostGameReportResult,
  RecommendedItemOutcome
} from '@shared/report'
import type { AppDatabase } from './db'
import { LiveSessionRepo, MatchRepo, MetaRepo } from './db/repos'
import { SettingsRepo, SETTING_KEYS } from './db/repos/settings'
import { createTranslator, normalizeLocale, t as translators, type Translator } from '@shared/i18n'
import type { StatsService } from './stats'

const MAX_RECOMMENDED_ITEMS = 10
const MAX_SUMMARY_LINES = 5
/** Meta build comparison needs at least this many crawled builds. */
const META_MIN_ITEM_GAMES = 10

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
  >,
  /** Final build vs the most-bought Master+ items (null = no meta data). */
  metaBuild: { overlap: number; total: number } | null = null,
  t: Translator = translators.es
): string[] {
  const lines: string[] = []

  if (report.avgDeaths !== null && report.avgDeaths > 0) {
    if (report.deaths >= report.avgDeaths + 2) {
      lines.push(
        t('report.sum.deathsHigh', {
          deaths: String(report.deaths),
          avg: report.avgDeaths.toFixed(1),
          champion: report.champion
        })
      )
    } else if (report.deaths <= report.avgDeaths - 1) {
      lines.push(
        t('report.sum.deathsLow', {
          deaths: String(report.deaths),
          avg: report.avgDeaths.toFixed(1)
        })
      )
    }
  }

  if (report.avgVisionScore !== null && report.avgVisionScore > 0) {
    if (report.visionScore < report.avgVisionScore * 0.8) {
      lines.push(
        t('report.sum.visionLow', {
          score: String(Math.round(report.visionScore)),
          avg: report.avgVisionScore.toFixed(0)
        })
      )
    } else if (report.visionScore > report.avgVisionScore * 1.2) {
      lines.push(
        t('report.sum.visionGood', {
          score: String(Math.round(report.visionScore)),
          avg: report.avgVisionScore.toFixed(0)
        })
      )
    }
  }

  if (report.avgCsPerMin !== null && report.avgCsPerMin > 0) {
    if (report.csPerMin < report.avgCsPerMin * 0.85) {
      lines.push(
        t('report.sum.csLow', {
          cs: report.csPerMin.toFixed(1),
          avg: report.avgCsPerMin.toFixed(1)
        })
      )
    }
  }

  if (report.avgDamageSharePct !== null && report.avgDamageSharePct > 0) {
    if (report.damageSharePct > report.avgDamageSharePct * 1.2) {
      lines.push(
        t('report.sum.dmgHigh', {
          pct: report.damageSharePct.toFixed(0),
          avg: report.avgDamageSharePct.toFixed(0)
        })
      )
    }
  }

  const total = report.recommendedItems.length
  if (total >= 3) {
    const followed = report.recommendedItems.filter((item) => item.followed).length
    const ratio = followed / total
    if (ratio >= 0.7) {
      lines.push(
        t('report.sum.buildConsistent', { followed: String(followed), total: String(total) })
      )
    } else if (ratio < 0.4) {
      lines.push(t('report.sum.buildFew', { followed: String(followed), total: String(total) }))
    }
  }

  if (metaBuild !== null && metaBuild.total >= 3) {
    if (metaBuild.overlap >= metaBuild.total - 1) {
      lines.push(
        t('report.sum.metaHigh', {
          overlap: String(metaBuild.overlap),
          total: String(metaBuild.total),
          champion: report.champion
        })
      )
    } else if (metaBuild.overlap <= Math.floor(metaBuild.total / 2)) {
      lines.push(
        t('report.sum.metaLow', {
          overlap: String(metaBuild.overlap),
          total: String(metaBuild.total)
        })
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
  private readonly meta: MetaRepo
  private readonly settings: SettingsRepo

  constructor(
    db: AppDatabase,
    private readonly stats: StatsService
  ) {
    this.sessions = new LiveSessionRepo(db)
    this.matches = new MatchRepo(db)
    this.meta = new MetaRepo(db)
    this.settings = new SettingsRepo(db)
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
    return this.buildReport(puuid, session.matchId, session.id)
  }

  /**
   * Report for any stored match (Historial → Ver informe). Recommendation
   * outcomes appear when a live session was linked to that match.
   */
  forMatch(puuid: string, matchId: string): PostGameReportResult | null {
    const session = this.sessions.sessionByMatchId(matchId)
    return this.buildReport(puuid, matchId, session?.id ?? null)
  }

  private buildReport(
    puuid: string,
    matchId: string,
    sessionId: number | null
  ): PostGameReportResult | null {
    const match = this.matches.getMatch(matchId)
    if (!match) return null
    const participants = this.matches.getParticipants(matchId)
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
    const recommendedItems =
      sessionId === null ? [] : this.recommendedItems(sessionId, finalItems)

    const report: PostGameReport = {
      matchId,
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
    const t = createTranslator(normalizeLocale(this.settings.get(SETTING_KEYS.locale)))
    report.summary = buildReportSummary(report, this.metaBuildComparison(own, finalItems), t)
    return { kind: 'report', report }
  }

  /** Overlap between the final build and the Master+ most-bought items. */
  private metaBuildComparison(
    own: { champion: string; role: string },
    finalItems: Set<number>
  ): { overlap: number; total: number } | null {
    const patch = this.meta.latestPatch()
    if (patch === null || finalItems.size < 3) return null
    const top = this.meta.topItems(own.champion, own.role, patch, 10)
    if (top.length < 5 || (top[0]?.games ?? 0) < META_MIN_ITEM_GAMES) return null
    const topIds = new Set(top.map((item) => item.itemId))
    const overlap = [...finalItems].filter((id) => topIds.has(id)).length
    return { overlap, total: finalItems.size }
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
