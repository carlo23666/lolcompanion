import { timelineSchema } from '@shared/schemas/riot'
import type {
  HistoryAggregate,
  HistoryDetail,
  HistoryRow
} from '@shared/history'
import type { AppDatabase } from './db'
import { MatchRepo, TimelineRepo } from './db/repos'

/** Read-side service for the Historial view. Pure queries, no network. */
export class HistoryService {
  private readonly matches: MatchRepo
  private readonly timelines: TimelineRepo

  constructor(db: AppDatabase) {
    this.matches = new MatchRepo(db)
    this.timelines = new TimelineRepo(db)
  }

  list(puuid: string, champion?: string, limit = 100): HistoryRow[] {
    return this.matches.ownerMatches(puuid, { champion, limit }).map(({ match, own }) => ({
      matchId: match.matchId,
      champion: own.champion,
      role: own.role,
      kills: own.kills,
      deaths: own.deaths,
      assists: own.assists,
      csPerMin: match.durationS > 0 ? (own.cs / match.durationS) * 60 : 0,
      win: own.win,
      durationS: match.durationS,
      patch: match.patch,
      gameCreation: match.gameCreation,
      queueId: match.queueId
    }))
  }

  champions(puuid: string): string[] {
    const seen = new Set<string>()
    for (const { own } of this.matches.ownerMatches(puuid, { limit: 500 })) {
      seen.add(own.champion)
    }
    return [...seen].sort()
  }

  /** Winrate + CS/min per champion over the last `window` games. */
  aggregates(puuid: string, window = 20): HistoryAggregate[] {
    const rows = this.matches.ownerMatches(puuid, { limit: window })
    const byChampion = new Map<string, { games: number; wins: number; csPerMin: number[] }>()
    for (const { match, own } of rows) {
      const entry = byChampion.get(own.champion) ?? { games: 0, wins: 0, csPerMin: [] }
      entry.games += 1
      if (own.win) entry.wins += 1
      if (match.durationS > 0) entry.csPerMin.push((own.cs / match.durationS) * 60)
      byChampion.set(own.champion, entry)
    }
    return [...byChampion.entries()]
      .map(([champion, entry]) => ({
        champion,
        games: entry.games,
        winratePct: (entry.wins / entry.games) * 100,
        csPerMin:
          entry.csPerMin.length > 0
            ? entry.csPerMin.reduce((sum, value) => sum + value, 0) / entry.csPerMin.length
            : 0
      }))
      .sort((a, b) => b.games - a.games)
  }

  detail(puuid: string, matchId: string): HistoryDetail | null {
    const match = this.matches.getMatch(matchId)
    if (!match) return null
    const own = this.matches.getParticipants(matchId).find((p) => p.puuid === puuid)
    if (!own) return null

    // Per-minute gold curve for the owner, from the stored timeline.
    let goldCurve: number[] = []
    const rawTimeline = this.timelines.getTimelineRaw(matchId)
    if (rawTimeline) {
      const parsed = timelineSchema.safeParse(rawTimeline)
      if (parsed.success) {
        const participantIndex = parsed.data.metadata.participants.indexOf(puuid)
        const participantId =
          parsed.data.info.participants?.find((p) => p.puuid === puuid)?.participantId ??
          (participantIndex >= 0 ? participantIndex + 1 : -1)
        if (participantId > 0) {
          goldCurve = parsed.data.info.frames.map(
            (frame) => frame.participantFrames[String(participantId)]?.totalGold ?? 0
          )
        }
      }
    }

    return {
      matchId,
      champion: own.champion,
      win: own.win,
      kills: own.kills,
      deaths: own.deaths,
      assists: own.assists,
      cs: own.cs,
      gold: own.gold,
      damage: own.damage,
      vision: own.vision,
      durationS: match.durationS,
      patch: match.patch,
      // Slots 0-5 only: slot 6 is the trinket, not part of the build.
      items: own.items.slice(0, 6).filter((id) => id > 0),
      goldCurve
    }
  }
}
