import type { RiotMatch } from '@shared/schemas/riot'
import type { MatchRepo, TimelineRepo, MatchRow, ParticipantRow } from '../db/repos'
import type { RiotClient } from './client'

export interface IngestProgress {
  fetched: number
  stored: number
  skipped: number
  failed: number
  done: boolean
  currentMatchId?: string
  error?: string
}

export interface IngestOptions {
  client: RiotClient
  matchRepo: MatchRepo
  timelineRepo: TimelineRepo
  puuid: string
  /** Stop after this many stored matches (default: full history). */
  maxMatches?: number
  onProgress?: (progress: IngestProgress) => void
  /** Return true to cancel between matches. */
  isCancelled?: () => boolean
  /** Backfill priority: interactive requests should use lower numbers. */
  priority?: number
}

/**
 * Walks the owner's matchlist newest→oldest and stores match + timeline via
 * the repos. Resumable by construction: already-stored ids are skipped, so a
 * killed sync continues where it left off on the next run.
 */
export async function ingestHistory(options: IngestOptions): Promise<IngestProgress> {
  const { client, matchRepo, timelineRepo, puuid } = options
  const priority = options.priority ?? 20
  const progress: IngestProgress = { fetched: 0, stored: 0, skipped: 0, failed: 0, done: false }
  const report = (): void => options.onProgress?.({ ...progress })

  const stored = matchRepo.matchIds()
  const withTimeline = timelineRepo.matchIdsWithTimeline()
  const pageSize = 100

  for (let start = 0; ; start += pageSize) {
    if (options.isCancelled?.()) break
    const page = await client.matchIds(puuid, { start, count: pageSize }, priority)
    if (!page.ok) {
      progress.error = page.error.message
      break
    }
    if (page.value.length === 0) break

    for (const matchId of page.value) {
      if (options.isCancelled?.()) break
      progress.currentMatchId = matchId

      const haveMatch = stored.has(matchId)
      const haveTimeline = withTimeline.has(matchId)
      if (haveMatch && haveTimeline) {
        progress.skipped += 1
        report()
        continue
      }

      if (!haveMatch) {
        const match = await client.match(matchId, priority)
        if (!match.ok) {
          if (match.error.kind === 'forbidden') {
            progress.error = match.error.message
            progress.done = false
            report()
            return progress
          }
          progress.failed += 1
          report()
          continue
        }
        const { row, participants } = matchToRows(match.value)
        matchRepo.insertMatch(row, match.value, ownerAware(participants, puuid, row))
        stored.add(matchId)
        progress.fetched += 1
      }

      if (!haveTimeline) {
        const timeline = await client.timeline(matchId, priority)
        if (timeline.ok) {
          timelineRepo.insertTimeline(matchId, timeline.value)
          withTimeline.add(matchId)
        } else if (timeline.error.kind === 'forbidden') {
          progress.error = timeline.error.message
          report()
          return progress
        } else {
          progress.failed += 1
        }
      }

      progress.stored += 1
      report()
      if (options.maxMatches !== undefined && progress.stored >= options.maxMatches) {
        progress.done = true
        report()
        return progress
      }
    }

    if (page.value.length < pageSize) break
  }

  progress.done = progress.error === undefined
  report()
  return progress
}

/** Maps a match-v5 payload to storage rows. */
export function matchToRows(match: RiotMatch): {
  row: MatchRow
  participants: ParticipantRow[]
} {
  const patch = match.info.gameVersion.split('.').slice(0, 2).join('.')
  const participants: ParticipantRow[] = match.info.participants.map((p) => ({
    matchId: match.metadata.matchId,
    puuid: p.puuid,
    champion: p.championName,
    role: p.teamPosition ?? '',
    win: p.win,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    cs: p.totalMinionsKilled + (p.neutralMinionsKilled ?? 0),
    gold: p.goldEarned,
    damage: p.totalDamageDealtToChampions,
    vision: p.visionScore ?? 0,
    items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6]
  }))
  return {
    row: {
      matchId: match.metadata.matchId,
      queueId: match.info.queueId,
      patch,
      gameCreation: match.info.gameCreation,
      durationS: match.info.gameDuration,
      win: null
    },
    participants
  }
}

/** Sets matches.win from the owner's participant row. */
function ownerAware(
  participants: ParticipantRow[],
  puuid: string,
  row: MatchRow
): ParticipantRow[] {
  const own = participants.find((p) => p.puuid === puuid)
  if (own) row.win = own.win
  return participants
}
