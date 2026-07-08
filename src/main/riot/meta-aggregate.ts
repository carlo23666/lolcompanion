import type { RiotMatch, RiotTimeline } from '@shared/schemas/riot'

/** Deltas one match contributes to the meta tables. Pure data, no I/O. */
export interface MetaMatchAggregate {
  matchId: string
  patch: string
  championStats: { champion: string; role: string; win: boolean }[]
  matchups: { champion: string; role: string; enemyChampion: string; win: boolean }[]
  items: { champion: string; role: string; itemId: number; win: boolean }[]
}

const RANKED_SOLO_QUEUE = 420
/** Games shorter than this are remakes — no signal. */
const MIN_DURATION_S = 300

/** "16.13.512.331" → "16.13". */
export function patchOf(gameVersion: string): string {
  return gameVersion.split('.').slice(0, 2).join('.')
}

/**
 * Aggregates one ranked-solo match into meta deltas: per-champion result,
 * same-lane matchup results, and final-build item frequencies. Returns null
 * for anything that isn't a real ranked game (wrong queue, remake).
 */
export function aggregateMatch(match: RiotMatch): MetaMatchAggregate | null {
  if (match.info.queueId !== RANKED_SOLO_QUEUE) return null
  if (match.info.gameDuration < MIN_DURATION_S) return null

  const patch = patchOf(match.info.gameVersion)
  const aggregate: MetaMatchAggregate = {
    matchId: match.metadata.matchId,
    patch,
    championStats: [],
    matchups: [],
    items: []
  }

  for (const participant of match.info.participants) {
    const role = participant.teamPosition ?? ''
    aggregate.championStats.push({
      champion: participant.championName,
      role,
      win: participant.win
    })

    // Final build: item slots 0-5 (6 is the trinket), zeros are empty slots.
    const itemIds = new Set(
      [
        participant.item0,
        participant.item1,
        participant.item2,
        participant.item3,
        participant.item4,
        participant.item5
      ].filter((id) => id > 0)
    )
    for (const itemId of itemIds) {
      aggregate.items.push({ champion: participant.championName, role, itemId, win: participant.win })
    }

    if (role !== '') {
      const rival = match.info.participants.find(
        (candidate) =>
          candidate.teamId !== participant.teamId && (candidate.teamPosition ?? '') === role
      )
      if (rival) {
        aggregate.matchups.push({
          champion: participant.championName,
          role,
          enemyChampion: rival.championName,
          win: participant.win
        })
      }
    }
  }

  return aggregate
}

/** Deltas one timeline contributes to meta_champion_item_order (WP-015). */
export interface MetaOrderAggregate {
  matchId: string
  patch: string
  items: { champion: string; role: string; itemId: number; slot: number; first: boolean }[]
}

/**
 * Extracts per-participant item COMPLETION order from a match timeline:
 * for each finished build item (caller passes the predicate — the aggregate
 * stays pure), the 1-based position in which it was first purchased.
 * ITEM_UNDO/ITEM_SOLD are deliberately ignored: for finished items they are
 * noise-level and tracking them would complicate resume/idempotency.
 * Returns null when the timeline doesn't belong to the match or the match
 * isn't an aggregatable ranked game (same gates as aggregateMatch).
 */
export function aggregateTimelineOrder(
  match: RiotMatch,
  timeline: RiotTimeline,
  isOrderable: (itemId: number) => boolean
): MetaOrderAggregate | null {
  if (timeline.metadata.matchId !== match.metadata.matchId) return null
  if (match.info.queueId !== RANKED_SOLO_QUEUE) return null
  if (match.info.gameDuration < MIN_DURATION_S) return null

  const byParticipant = new Map<number, { champion: string; role: string }>()
  for (const [index, participant] of match.info.participants.entries()) {
    byParticipant.set(participant.participantId ?? index + 1, {
      champion: participant.championName,
      role: participant.teamPosition ?? ''
    })
  }

  // Purchase events arrive frame by frame, already in chronological order.
  const seen = new Map<number, Set<number>>()
  const aggregate: MetaOrderAggregate = {
    matchId: match.metadata.matchId,
    patch: patchOf(match.info.gameVersion),
    items: []
  }
  for (const frame of timeline.info.frames) {
    for (const event of frame.events) {
      if (event.type !== 'ITEM_PURCHASED') continue
      const participantId = event.participantId
      const itemId = event.itemId
      if (participantId === undefined || itemId === undefined) continue
      if (!isOrderable(itemId)) continue
      const owner = byParticipant.get(participantId)
      if (!owner) continue
      const owned = seen.get(participantId) ?? new Set<number>()
      if (owned.has(itemId)) continue // repurchase: first occurrence decides
      owned.add(itemId)
      seen.set(participantId, owned)
      aggregate.items.push({
        champion: owner.champion,
        role: owner.role,
        itemId,
        slot: owned.size,
        first: owned.size === 1
      })
    }
  }
  return aggregate
}
