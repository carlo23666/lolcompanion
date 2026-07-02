import type {
  GameState,
  ObjectivesState,
  PlayerState,
  SelfState
} from '@shared/gamestate'
import type { RiotMatch, RiotTimeline, RiotTimelineEvent } from '@shared/schemas/riot'
import { computeAggregates } from '../engine/normalize'
import { championStatsAtLevel } from '../staticdata/champstats'
import type { StaticData } from '../staticdata/manager'

/**
 * Rebuilds an approximate GameState at every timeline frame (minute
 * granularity) so stored games can be replayed through the engine.
 *
 * Known reconstruction gaps (accepted, documented):
 * - Items only via purchase/sell/undo/destroy events — start-of-game items
 *   and some consumables may drift; enemy inventories are exactly as visible
 *   in a real game (purchase events), matching the live constraint.
 * - isDead/respawnTimer are not tracked (frame granularity too coarse).
 * - Runes are unknown → empty.
 * - Gold IS exact for every player (participantFrames.totalGold), which is
 *   precisely what makes the harness useful for calibrating estimators.
 */

export interface ReconstructedFrame {
  minute: number
  state: GameState
  /** The owner's next COMPLETED item purchase after this frame, if any. */
  actualNextPurchase: number | null
}

interface TrackedPlayer {
  participantId: number
  puuid: string
  championName: string
  championId: string
  team: 'ORDER' | 'CHAOS'
  position: string
  items: Map<number, number>
  kills: number
  deaths: number
  assists: number
}

function isCompletedItem(itemId: number, staticData: StaticData): boolean {
  const node = staticData.itemGraph.nodes.get(itemId)
  if (!node) return false
  return node.depth >= 2 && (node.buildsInto.length === 0 || node.tags.includes('Boots'))
}

function addItem(player: TrackedPlayer, itemId: number): void {
  player.items.set(itemId, (player.items.get(itemId) ?? 0) + 1)
}

function removeItem(player: TrackedPlayer, itemId: number): void {
  const count = player.items.get(itemId) ?? 0
  if (count <= 1) player.items.delete(itemId)
  else player.items.set(itemId, count - 1)
}

function applyEvent(
  event: RiotTimelineEvent,
  players: Map<number, TrackedPlayer>,
  objectives: ObjectivesState
): void {
  const raw = event as Record<string, unknown>
  const actor = event.participantId !== undefined ? players.get(event.participantId) : undefined
  switch (event.type) {
    case 'ITEM_PURCHASED':
      if (actor && event.itemId !== undefined) addItem(actor, event.itemId)
      break
    case 'ITEM_SOLD':
    case 'ITEM_DESTROYED':
      if (actor && event.itemId !== undefined) removeItem(actor, event.itemId)
      break
    case 'ITEM_UNDO': {
      const beforeId = typeof raw['beforeId'] === 'number' ? raw['beforeId'] : 0
      const afterId = typeof raw['afterId'] === 'number' ? raw['afterId'] : 0
      if (actor) {
        if (beforeId > 0) removeItem(actor, beforeId)
        if (afterId > 0) addItem(actor, afterId)
      }
      break
    }
    case 'CHAMPION_KILL': {
      const killer = event.killerId !== undefined ? players.get(event.killerId) : undefined
      const victim = event.victimId !== undefined ? players.get(event.victimId) : undefined
      if (killer) killer.kills += 1
      if (victim) victim.deaths += 1
      const assisters = raw['assistingParticipantIds']
      if (Array.isArray(assisters)) {
        for (const assisterId of assisters) {
          if (typeof assisterId === 'number') {
            const assister = players.get(assisterId)
            if (assister) assister.assists += 1
          }
        }
      }
      break
    }
    case 'ELITE_MONSTER_KILL': {
      const killerTeamId = typeof raw['killerTeamId'] === 'number' ? raw['killerTeamId'] : null
      const killer = event.killerId !== undefined ? players.get(event.killerId) : undefined
      const team: 'ORDER' | 'CHAOS' | null =
        killerTeamId === 100 ? 'ORDER' : killerTeamId === 200 ? 'CHAOS' : (killer?.team ?? null)
      if (team === null) break
      if (event.monsterType === 'DRAGON') {
        const subtype = (event.monsterSubType ?? 'UNKNOWN').replace('_DRAGON', '')
        objectives.dragons[team].push(subtype)
      } else if (event.monsterType === 'BARON_NASHOR') {
        objectives.barons[team] += 1
      } else if (event.monsterType === 'RIFTHERALD') {
        objectives.heralds[team] += 1
      }
      break
    }
    case 'BUILDING_KILL': {
      if (event.buildingType !== 'TOWER_BUILDING') break
      // teamId is the team whose tower fell → credit the other team.
      if (event.teamId === 100) objectives.towers.CHAOS += 1
      else if (event.teamId === 200) objectives.towers.ORDER += 1
      break
    }
    default:
      break
  }
}

export function reconstructFrames(
  match: RiotMatch,
  timeline: RiotTimeline,
  ownerPuuid: string,
  staticData: StaticData
): ReconstructedFrame[] {
  const puuids = timeline.metadata.participants
  const players = new Map<number, TrackedPlayer>()
  for (const participant of match.info.participants) {
    const index = puuids.indexOf(participant.puuid)
    if (index < 0) continue
    const champion = staticData.champions.get(participant.championName)
    players.set(index + 1, {
      participantId: index + 1,
      puuid: participant.puuid,
      championName: participant.championName,
      championId: champion?.id ?? participant.championName,
      team: participant.teamId === 100 ? 'ORDER' : 'CHAOS',
      position: participant.teamPosition ?? '',
      items: new Map(),
      kills: 0,
      deaths: 0,
      assists: 0
    })
  }
  const owner = [...players.values()].find((player) => player.puuid === ownerPuuid)
  if (!owner) return []

  const objectives: ObjectivesState = {
    dragons: { ORDER: [], CHAOS: [] },
    barons: { ORDER: 0, CHAOS: 0 },
    heralds: { ORDER: 0, CHAOS: 0 },
    towers: { ORDER: 0, CHAOS: 0 }
  }
  const patch = match.info.gameVersion.split('.').slice(0, 2).join('.')

  // Precompute the owner's completed-item purchases for "actual next buy".
  const ownerPurchases: { timestamp: number; itemId: number }[] = []
  for (const frame of timeline.info.frames) {
    for (const event of frame.events) {
      if (
        event.type === 'ITEM_PURCHASED' &&
        event.participantId === owner.participantId &&
        event.itemId !== undefined &&
        isCompletedItem(event.itemId, staticData)
      ) {
        ownerPurchases.push({ timestamp: event.timestamp, itemId: event.itemId })
      }
    }
  }

  const frames: ReconstructedFrame[] = []
  for (const frame of timeline.info.frames) {
    for (const event of frame.events) {
      applyEvent(event, players, objectives)
    }

    const toPlayerState = (tracked: TrackedPlayer): PlayerState | null => {
      const pf = frame.participantFrames[String(tracked.participantId)]
      if (!pf) return null
      const items = [...tracked.items.entries()].flatMap(([itemId, count]) => {
        const node = staticData.itemGraph.nodes.get(itemId)
        if (!node) return []
        return Array.from({ length: count }, () => ({
          id: node.id,
          name: node.name,
          totalGold: node.totalGold,
          isCompleted: isCompletedItem(itemId, staticData),
          tags: node.tags,
          stats: node.stats
        }))
      })
      const champion = staticData.champions.get(tracked.championId)
      const base = champion
        ? championStatsAtLevel(champion.stats, pf.level)
        : { hp: 1000, armor: 50, magicResist: 40, attackDamage: 60, attackSpeed: 0.7 }
      let hp = base.hp
      let armor = base.armor
      let magicResist = base.magicResist
      let attackDamage = base.attackDamage
      for (const item of items) {
        hp += item.stats['FlatHPPoolMod'] ?? 0
        armor += item.stats['FlatArmorMod'] ?? 0
        magicResist += item.stats['FlatSpellBlockMod'] ?? 0
        attackDamage += item.stats['FlatPhysicalDamageMod'] ?? 0
      }
      return {
        championId: tracked.championId,
        championName: tracked.championName,
        team: tracked.team,
        level: pf.level,
        position: tracked.position,
        isDead: false,
        respawnTimer: 0,
        scores: {
          kills: tracked.kills,
          deaths: tracked.deaths,
          assists: tracked.assists,
          creepScore: pf.minionsKilled + pf.jungleMinionsKilled,
          wardScore: 0
        },
        items,
        damageType: staticData.damageProfile(tracked.championId),
        estimatedGoldEarned: pf.totalGold, // exact — from the timeline
        estimatedStats: { hp, armor, magicResist, attackDamage }
      }
    }

    const states = new Map<number, PlayerState>()
    for (const [participantId, tracked] of players) {
      const playerState = toPlayerState(tracked)
      if (playerState) states.set(participantId, playerState)
    }
    const ownerState = states.get(owner.participantId)
    const ownerFrame = frame.participantFrames[String(owner.participantId)]
    if (!ownerState || !ownerFrame) continue

    const itemAp = ownerState.items.reduce(
      (sum, item) => sum + (item.stats['FlatMagicDamageMod'] ?? 0),
      0
    )
    const self: SelfState = {
      ...ownerState,
      currentGold: ownerFrame.currentGold, // exact
      stats: {
        abilityPower: itemAp,
        attackDamage: ownerState.estimatedStats.attackDamage,
        armor: ownerState.estimatedStats.armor,
        magicResist: ownerState.estimatedStats.magicResist,
        currentHealth: ownerState.estimatedStats.hp,
        maxHealth: ownerState.estimatedStats.hp,
        attackSpeed: 0,
        critChance: 0,
        moveSpeed: 0
      },
      runeIds: []
    }

    const allies = [...states.values()].filter(
      (player) => player.team === self.team && player.championName !== self.championName
    )
    const enemies = [...states.values()].filter((player) => player.team !== self.team)

    const minute = Math.round(frame.timestamp / 60000)
    const nextPurchase = ownerPurchases.find((purchase) => purchase.timestamp > frame.timestamp)

    frames.push({
      minute,
      actualNextPurchase: nextPurchase?.itemId ?? null,
      state: {
        gameTimeS: frame.timestamp / 1000,
        patch,
        gameMode: match.info.gameMode ?? 'CLASSIC',
        self,
        allies,
        enemies,
        objectives: structuredClone(objectives),
        allyAggregates: computeAggregates([self, ...allies]),
        enemyAggregates: computeAggregates(enemies)
      }
    })
  }
  return frames
}
