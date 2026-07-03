import type { GameScenario, ScenarioPlayerSpec } from '@shared/scenario'
import type { LiveClientPlayer, LiveClientSnapshot } from '@shared/schemas/liveclient'
import type { DdChampion } from '@shared/schemas/ddragon'
import type { StaticData } from './staticdata/manager'

/** Self riotId in synthetic snapshots (policy-safe placeholder names). */
const SELF_RIOT_ID = 'PLAYER_1#SIM'

const MAGICAL_FOOTWEAR_RUNE_ID = 8304

/** Typical creep score per minute by position (defaults for scenarios). */
const CS_PER_MIN: Record<string, number> = {
  TOP: 7,
  JUNGLE: 5.5,
  MIDDLE: 8,
  BOTTOM: 8.5,
  UTILITY: 1
}

function findChampion(staticData: StaticData, nameOrId: string): DdChampion | null {
  return (
    staticData.champions.get(nameOrId) ?? staticData.championsByName.get(nameOrId) ?? null
  )
}

/** Rough level from game time when the scenario doesn't pin one. */
function defaultLevel(gameTimeS: number): number {
  return Math.max(1, Math.min(18, Math.round(1 + (gameTimeS / 60) * 0.55)))
}

function buildPlayer(
  spec: ScenarioPlayerSpec,
  staticData: StaticData,
  options: { team: 'ORDER' | 'CHAOS'; riotId: string; gameTimeS: number }
): { player: LiveClientPlayer; error?: string } {
  const champion = findChampion(staticData, spec.champion)
  const level = spec.level ?? defaultLevel(options.gameTimeS)
  const position = (spec.position ?? '').toUpperCase()
  const csPerMin = CS_PER_MIN[position] ?? 6
  const player: LiveClientPlayer = {
    championName: champion?.name ?? spec.champion,
    team: options.team,
    level,
    isBot: false,
    isDead: spec.dead ?? false,
    respawnTimer: spec.dead === true ? 20 : 0,
    position,
    items: (spec.items ?? []).map((itemId, index) => ({
      itemID: itemId,
      count: 1,
      slot: index,
      displayName: staticData.itemGraph.nodes.get(itemId)?.name ?? `objeto ${String(itemId)}`,
      price: staticData.itemGraph.nodes.get(itemId)?.totalGold ?? 0
    })),
    scores: {
      kills: spec.kills ?? 0,
      deaths: spec.deaths ?? 0,
      assists: 0,
      creepScore: Math.round((options.gameTimeS / 60) * csPerMin),
      wardScore: Math.round(options.gameTimeS / 60)
    },
    riotId: options.riotId,
    summonerName: options.riotId
  }
  return {
    player,
    error: champion === null ? `campeón desconocido: ${spec.champion}` : undefined
  }
}

/**
 * Builds a schema-valid Live Client snapshot from a scenario. Champion stats
 * for the active player are base+growth estimates from Data Dragon — good
 * enough for every rule (the engine leans on gold/items/comps, not raw HP).
 */
export function buildScenarioSnapshot(
  scenario: GameScenario,
  staticData: StaticData
): { snapshot: LiveClientSnapshot | null; errors: string[] } {
  const errors: string[] = []
  const players: LiveClientPlayer[] = []

  const self = buildPlayer(scenario.self, staticData, {
    team: 'ORDER',
    riotId: SELF_RIOT_ID,
    gameTimeS: scenario.gameTimeS
  })
  if (self.error !== undefined) errors.push(self.error)
  players.push(self.player)

  scenario.allies.slice(0, 4).forEach((spec, index) => {
    const built = buildPlayer(spec, staticData, {
      team: 'ORDER',
      riotId: `PLAYER_${String(index + 2)}#SIM`,
      gameTimeS: scenario.gameTimeS
    })
    if (built.error !== undefined) errors.push(built.error)
    players.push(built.player)
  })
  scenario.enemies.slice(0, 5).forEach((spec, index) => {
    const built = buildPlayer(spec, staticData, {
      team: 'CHAOS',
      riotId: `PLAYER_${String(index + 6)}#SIM`,
      gameTimeS: scenario.gameTimeS
    })
    if (built.error !== undefined) errors.push(built.error)
    players.push(built.player)
  })
  if (errors.length > 0) return { snapshot: null, errors }

  const selfChampion = findChampion(staticData, scenario.self.champion)
  const level = scenario.self.level ?? defaultLevel(scenario.gameTimeS)
  const stats = selfChampion?.stats
  const at = (base: number | undefined, perLevel: number | undefined): number =>
    (base ?? 0) + (perLevel ?? 0) * (level - 1)

  const snapshot: LiveClientSnapshot = {
    activePlayer: {
      currentGold: scenario.gold,
      level,
      riotId: SELF_RIOT_ID,
      summonerName: SELF_RIOT_ID,
      championStats: {
        abilityPower: 0,
        armor: at(stats?.armor, stats?.armorperlevel),
        attackDamage: at(stats?.attackdamage, stats?.attackdamageperlevel),
        attackRange: stats?.attackrange ?? 550,
        attackSpeed: stats?.attackspeed ?? 0.65,
        critChance: 0,
        critDamage: 175,
        currentHealth: at(stats?.hp, stats?.hpperlevel),
        magicResist: at(stats?.spellblock, stats?.spellblockperlevel),
        maxHealth: at(stats?.hp, stats?.hpperlevel),
        moveSpeed: stats?.movespeed ?? 335,
        resourceMax: 1000,
        resourceType: 'MANA',
        resourceValue: 800
      },
      fullRunes:
        scenario.magicalFootwear === true
          ? {
              keystone: { id: 8005 },
              generalRunes: [{ id: MAGICAL_FOOTWEAR_RUNE_ID, displayName: 'Calzado mágico' }]
            }
          : { keystone: { id: 8005 }, generalRunes: [] }
    },
    allPlayers: players,
    events: {
      Events: [{ EventID: 0, EventName: 'GameStart', EventTime: 0 }]
    },
    gameData: {
      gameMode: 'CLASSIC',
      gameTime: scenario.gameTimeS,
      mapName: 'Map11',
      mapNumber: 11
    }
  }
  return { snapshot, errors: [] }
}
