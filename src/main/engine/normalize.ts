import type {
  LiveClientPlayer,
  LiveClientSnapshot
} from '@shared/schemas/liveclient'
import type {
  DamageType,
  EstimatedCombatStats,
  GameState,
  GameStateItem,
  ObjectivesState,
  PlayerState,
  SelfState,
  TeamAggregates
} from '@shared/gamestate'
import type { StaticData } from '../staticdata/manager'
import { championStatsAtLevel } from '../staticdata/champstats'

/**
 * Pure normalizer: (Live Client snapshot, StaticData) → GameState.
 * NO I/O in this module.
 *
 * ============================ GOLD MODEL =================================
 * Enemy gold is not exposed by the Live Client (by design). Estimate of
 * TOTAL gold earned per player:
 *
 *   gold(t) = 500                        starting gold (SR)
 *           + 2.04 * max(0, t - 110)     passive income: 20.4 per 10s from 1:50
 *           + creepScore * 21            avg minion value (melee/caster/siege mix)
 *           + kills * 300                flat bounty approximation
 *           + assists * 150              typical assist share
 *
 * Known biases (accepted, target ±15% by min 10-20): ignores first blood,
 * bounties, plates, objectives, support item income and wards. Supports and
 * junglers are underestimated the most.
 * =========================================================================
 */

const STARTING_GOLD = 500
const PASSIVE_GOLD_PER_S = 2.04
const PASSIVE_GOLD_START_S = 110
const GOLD_PER_CS = 21
const GOLD_PER_KILL = 300
const GOLD_PER_ASSIST = 150

export function estimateGoldEarned(
  gameTimeS: number,
  scores: { kills: number; assists: number; creepScore: number }
): number {
  return (
    STARTING_GOLD +
    PASSIVE_GOLD_PER_S * Math.max(0, gameTimeS - PASSIVE_GOLD_START_S) +
    scores.creepScore * GOLD_PER_CS +
    scores.kills * GOLD_PER_KILL +
    scores.assists * GOLD_PER_ASSIST
  )
}

/**
 * Champions whose kit heals/shields themselves or allies meaningfully.
 * Weight 2 = core identity (enchanters, drain tanks), 1 = notable sustain.
 */
export const HEALER_CHAMPION_WEIGHTS: Record<string, number> = {
  Soraka: 2,
  Yuumi: 2,
  Sona: 2,
  Nami: 2,
  Milio: 2,
  Lulu: 2,
  Janna: 2,
  Seraphine: 2,
  Karma: 1,
  Rakan: 1,
  Renata: 1,
  Taric: 2,
  Ivern: 1,
  Senna: 1,
  Nidalee: 1,
  Vladimir: 2,
  Aatrox: 2,
  DrMundo: 2,
  Sylas: 1,
  Warwick: 1,
  Briar: 1,
  Illaoi: 1,
  Maokai: 1,
  Swain: 1,
  Kayn: 1,
  Fiora: 1,
  Yorick: 1,
  Zac: 1,
  Volibear: 1,
  Olaf: 1,
  Trundle: 1
}

/** Item stat keys that indicate healing/lifesteal investment. */
const HEALING_ITEM_TAGS = new Set(['LifeSteal', 'SpellVamp'])

/** Damage profile → base (physical, magic) weights before item bias. */
const PROFILE_WEIGHTS: Record<DamageType, [number, number]> = {
  physical: [0.85, 0.15],
  magic: [0.15, 0.85],
  mixed: [0.5, 0.5]
}

function resolveItems(player: LiveClientPlayer, staticData: StaticData): GameStateItem[] {
  const items: GameStateItem[] = []
  for (const item of player.items) {
    const node = staticData.itemGraph.nodes.get(item.itemID)
    if (!node) continue
    items.push({
      id: node.id,
      name: node.name,
      totalGold: node.totalGold,
      // Completed = built from components AND not itself a component.
      // Tier-2 boots are completed purchases even though tier-3 upgrades
      // exist above them (standard convention in build tools).
      isCompleted:
        node.depth >= 2 && (node.buildsInto.length === 0 || node.tags.includes('Boots')),
      tags: node.tags,
      stats: node.stats
    })
  }
  return items
}

function estimateStats(
  championId: string,
  level: number,
  items: GameStateItem[],
  staticData: StaticData
): EstimatedCombatStats {
  const champion = staticData.champions.get(championId)
  const base = champion
    ? championStatsAtLevel(champion.stats, level)
    : { hp: 1000 + 90 * level, armor: 50, magicResist: 40, attackDamage: 60, attackSpeed: 0.7 }
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
  return { hp, armor, magicResist, attackDamage }
}

/**
 * Per-player physical/magic split: 60% champion profile, 40% item investment
 * (AD gold vs AP gold) when the player has bought damage items.
 */
export function playerDamageSplit(
  damageType: DamageType,
  items: GameStateItem[]
): [number, number] {
  const [profilePhys, profileMag] = PROFILE_WEIGHTS[damageType]
  let adGold = 0
  let apGold = 0
  for (const item of items) {
    adGold += (item.stats['FlatPhysicalDamageMod'] ?? 0) * 35
    apGold += (item.stats['FlatMagicDamageMod'] ?? 0) * 20
  }
  if (adGold + apGold === 0) return [profilePhys, profileMag]
  const itemPhys = adGold / (adGold + apGold)
  const phys = 0.6 * profilePhys + 0.4 * itemPhys
  return [phys, 1 - phys]
}

export function computeAggregates(players: PlayerState[]): TeamAggregates {
  if (players.length === 0) {
    return {
      physicalShare: 0.5,
      magicShare: 0.5,
      tankinessIndex: 0,
      healingIndex: 0,
      estimatedTotalGold: 0
    }
  }

  // Damage split weighted by estimated gold (fed players hit harder).
  let physWeighted = 0
  let magWeighted = 0
  let totalWeight = 0
  let effectiveHpSum = 0
  let healing = 0
  let totalGold = 0

  for (const player of players) {
    const [phys, mag] = playerDamageSplit(player.damageType, player.items)
    const weight = player.estimatedGoldEarned
    physWeighted += phys * weight
    magWeighted += mag * weight
    totalWeight += weight
    totalGold += player.estimatedGoldEarned

    // Effective HP vs a 50/50 attacker: hp * (1 + avg(resists)/100).
    const { hp, armor, magicResist } = player.estimatedStats
    effectiveHpSum += hp * (1 + (armor + magicResist) / 2 / 100)

    healing += HEALER_CHAMPION_WEIGHTS[player.championId] ?? 0
    for (const item of player.items) {
      if (item.tags.some((tag) => HEALING_ITEM_TAGS.has(tag))) healing += 0.5
    }
  }

  const physicalShare = totalWeight > 0 ? physWeighted / totalWeight : 0.5
  return {
    physicalShare,
    magicShare: totalWeight > 0 ? magWeighted / totalWeight : 0.5,
    tankinessIndex: effectiveHpSum / players.length,
    healingIndex: healing,
    estimatedTotalGold: totalGold
  }
}

function normalizePlayer(
  player: LiveClientPlayer,
  gameTimeS: number,
  staticData: StaticData
): PlayerState {
  const champion =
    staticData.championsByName.get(player.championName) ??
    staticData.champions.get(player.championName)
  const championId = champion?.id ?? ''
  const items = resolveItems(player, staticData)
  return {
    championId,
    championName: player.championName,
    team: player.team,
    level: player.level,
    position: player.position ?? '',
    isDead: player.isDead,
    respawnTimer: player.respawnTimer,
    ...(player.currentHealth !== undefined && player.maxHealth !== undefined
      ? { visibleHealth: { current: player.currentHealth, max: player.maxHealth } }
      : {}),
    scores: {
      kills: player.scores.kills,
      deaths: player.scores.deaths,
      assists: player.scores.assists,
      creepScore: player.scores.creepScore,
      wardScore: player.scores.wardScore
    },
    items,
    damageType: staticData.damageProfile(championId),
    estimatedGoldEarned: estimateGoldEarned(gameTimeS, player.scores),
    estimatedStats: estimateStats(championId, player.level, items, staticData)
  }
}

/** Tower name "Turret_T1_..." belongs to ORDER; destroying it scores CHAOS. */
export function parseObjectives(
  events: LiveClientSnapshot['events']['Events'],
  playerTeamByName: Map<string, 'ORDER' | 'CHAOS'>
): ObjectivesState {
  const objectives: ObjectivesState = {
    dragons: { ORDER: [], CHAOS: [] },
    barons: { ORDER: 0, CHAOS: 0 },
    heralds: { ORDER: 0, CHAOS: 0 },
    towers: { ORDER: 0, CHAOS: 0 }
  }
  for (const event of events) {
    const raw = event as Record<string, unknown>
    const killerName = typeof raw['KillerName'] === 'string' ? raw['KillerName'] : ''
    const killerTeam = playerTeamByName.get(killerName)
    switch (event.EventName) {
      case 'DragonKill': {
        if (!killerTeam) break
        const subtype = typeof raw['DragonType'] === 'string' ? raw['DragonType'] : 'UNKNOWN'
        objectives.dragons[killerTeam].push(subtype.toUpperCase())
        break
      }
      case 'BaronKill':
        if (killerTeam) objectives.barons[killerTeam] += 1
        break
      case 'HeraldKill':
        if (killerTeam) objectives.heralds[killerTeam] += 1
        break
      case 'TurretKilled': {
        const turret = typeof raw['TurretKilled'] === 'string' ? raw['TurretKilled'] : ''
        if (turret.includes('_T1_')) objectives.towers.CHAOS += 1
        else if (turret.includes('_T2_')) objectives.towers.ORDER += 1
        else if (killerTeam) objectives.towers[killerTeam] += 1
        break
      }
      default:
        break
    }
  }
  return objectives
}

/**
 * Normalizes a snapshot. Returns null when the active player cannot be
 * matched inside allPlayers (should not happen in a real own game).
 */
export function normalizeSnapshot(
  snapshot: LiveClientSnapshot,
  staticData: StaticData
): GameState | null {
  const gameTimeS = snapshot.gameData.gameTime
  const active = snapshot.activePlayer
  const ownName = active.riotId ?? active.summonerName
  const selfPlayer = snapshot.allPlayers.find(
    (player) => (player.riotId ?? player.summonerName) === ownName
  )
  if (!selfPlayer) return null

  const normalized = snapshot.allPlayers.map((player) =>
    normalizePlayer(player, gameTimeS, staticData)
  )
  const selfIndex = snapshot.allPlayers.indexOf(selfPlayer)
  const selfBase = normalized[selfIndex]
  if (!selfBase) return null

  const runeIds: number[] = []
  if (active.fullRunes) {
    if (active.fullRunes.keystone) runeIds.push(active.fullRunes.keystone.id)
    for (const rune of active.fullRunes.generalRunes ?? []) runeIds.push(rune.id)
  }

  const self: SelfState = {
    ...selfBase,
    level: active.level,
    currentGold: active.currentGold,
    stats: {
      abilityPower: active.championStats.abilityPower,
      attackDamage: active.championStats.attackDamage,
      armor: active.championStats.armor,
      magicResist: active.championStats.magicResist,
      currentHealth: active.championStats.currentHealth,
      maxHealth: active.championStats.maxHealth,
      attackSpeed: active.championStats.attackSpeed,
      critChance: active.championStats.critChance,
      moveSpeed: active.championStats.moveSpeed
    },
    runeIds
  }

  const allies = normalized.filter((p, i) => i !== selfIndex && p.team === self.team)
  const enemies = normalized.filter((p) => p.team !== self.team)

  const playerTeamByName = new Map<string, 'ORDER' | 'CHAOS'>()
  for (const player of snapshot.allPlayers) {
    const name = player.riotId ?? player.summonerName
    if (name !== undefined) playerTeamByName.set(name, player.team)
    // Some events reference the bare game name without the #TAG.
    if (name?.includes('#')) {
      const bare = name.split('#')[0]
      if (bare !== undefined) playerTeamByName.set(bare, player.team)
    }
  }

  return {
    gameTimeS,
    patch: staticData.patch,
    gameMode: snapshot.gameData.gameMode,
    self,
    allies,
    enemies,
    objectives: parseObjectives(snapshot.events.Events, playerTeamByName),
    allyAggregates: computeAggregates([self, ...allies]),
    enemyAggregates: computeAggregates(enemies)
  }
}
