import type { PostGameReport, RecommendedItemOutcome } from '@shared/report'
import type { AppDatabase } from './db'
import { LiveSessionRepo, MatchRepo } from './db/repos'
import type { StatsService } from './stats'

const MAX_RECOMMENDED_ITEMS = 10

/**
 * Builds the post-game report for the most recent live session that got
 * linked to a stored match (WP-010 linking): final stats vs the owner's
 * personal averages on that champion, plus which engine recommendations the
 * owner actually bought.
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

  lastReport(puuid: string): PostGameReport | null {
    const session = this.sessions
      .latestSessions(10)
      .find((candidate) => candidate.matchId !== null && candidate.matchId !== '')
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

    return {
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
      // Averages include this match too — acceptable v1 bias, noted in docs.
      avgCsPerMin: averages?.csPerMin ?? null,
      avgGoldPerMin: averages?.goldPerMin ?? null,
      avgDamageSharePct: averages?.damageSharePct ?? null,
      recommendedItems
    }
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
