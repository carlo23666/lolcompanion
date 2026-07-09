import type { MetaItemsInput, MetaItemStat } from './engine/meta-items'
import { isFinishedBuildItem } from './staticdata/itemgraph'
import type { StaticData } from './staticdata/manager'
import type { MatchRepo, TimelineRepo } from './db/repos'

/**
 * The player's OWN build results for a champion, in the SAME shape as the
 * Master+ distribution (WP-018). The engine blends this onto the Master+ base:
 * Master+ is the build, the player's own win rates and opener only tweak it.
 *
 * - `games`/`wins` per finished item come from the stored final builds
 *   (participants.items) — no payload parsing, always available.
 * - `firstGames`/`orderGames`/`slotSum` (the opener) come from stored timelines
 *   when present — best effort, so it degrades cleanly on installs without them.
 *
 * Pure over the two repos + static data; the caller decides when to look it up
 * (once per champion in a game, like the meta lookup).
 */
export function personalBuildFor(
  matches: MatchRepo,
  timelines: TimelineRepo,
  staticData: StaticData,
  opts: { puuid: string; champion: string; limit?: number }
): MetaItemsInput | undefined {
  const rows = matches.ownerMatches(opts.puuid, {
    champion: opts.champion,
    limit: opts.limit ?? 100
  })
  if (rows.length === 0) return undefined

  const isFinished = (id: number): boolean => {
    const node = staticData.itemGraph.nodes.get(id)
    return node !== undefined && isFinishedBuildItem(node)
  }

  interface Acc {
    games: number
    wins: number
    firstGames: number
    orderGames: number
    slotSum: number
  }
  const stats = new Map<number, Acc>()
  const bump = (id: number): Acc => {
    let acc = stats.get(id)
    if (acc === undefined) {
      acc = { games: 0, wins: 0, firstGames: 0, orderGames: 0, slotSum: 0 }
      stats.set(id, acc)
    }
    return acc
  }

  for (const { match, own } of rows) {
    // Final finished items (slots 0-5; slot 6 is the trinket), unique per game.
    const finals = new Set(own.items.slice(0, 6).filter((id) => id > 0 && isFinished(id)))
    for (const id of finals) {
      const acc = bump(id)
      acc.games += 1
      if (own.win) acc.wins += 1
    }
    // Completion order from the timeline (best effort).
    const order = personalOrder(matches, timelines, match.matchId, opts.puuid, isFinished)
    for (const [slot, id] of order.entries()) {
      const acc = stats.get(id)
      if (acc === undefined) continue // only order items that also survived to the final build
      acc.orderGames += 1
      acc.slotSum += slot + 1
      if (slot === 0) acc.firstGames += 1
    }
  }

  const items: MetaItemStat[] = [...stats.entries()]
    .map(([itemId, acc]) => ({
      itemId,
      games: acc.games,
      wins: acc.wins,
      ...(acc.orderGames > 0
        ? { orderGames: acc.orderGames, slotSum: acc.slotSum, firstGames: acc.firstGames }
        : {})
    }))
    .sort((a, b) => b.games - a.games)

  return { items, games: rows.length }
}

/**
 * The player's finished-item purchase order in one match, from the stored
 * timeline. Returns first-occurrence-deduped item ids; empty if the timeline is
 * missing or the player can't be located. Defensive over the raw payload (it
 * was schema-validated at ingestion; here we only read the shape we need).
 */
function personalOrder(
  matches: MatchRepo,
  timelines: TimelineRepo,
  matchId: string,
  puuid: string,
  isFinished: (id: number) => boolean
): number[] {
  const timelineRaw = timelines.getTimelineRaw(matchId)
  if (timelineRaw === null) return []
  const matchRaw = matches.getMatchRaw(matchId)
  if (matchRaw === null) return []

  const participants = readArray(readObject(matchRaw['info'])?.['participants'])
  let participantId: number | undefined
  for (const [index, participant] of participants.entries()) {
    const p = readObject(participant)
    if (p?.['puuid'] === puuid) {
      participantId = typeof p['participantId'] === 'number' ? p['participantId'] : index + 1
      break
    }
  }
  if (participantId === undefined) return []

  const frames = readArray(readObject(timelineRaw['info'])?.['frames'])
  const seen: number[] = []
  const owned = new Set<number>()
  for (const frame of frames) {
    for (const event of readArray(readObject(frame)?.['events'])) {
      const e = readObject(event)
      if (e === undefined || e['type'] !== 'ITEM_PURCHASED') continue
      if (e['participantId'] !== participantId) continue
      const itemId = e['itemId']
      if (typeof itemId !== 'number' || owned.has(itemId) || !isFinished(itemId)) continue
      owned.add(itemId)
      seen.push(itemId)
    }
  }
  return seen
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
