import type { PlayerState } from '@shared/gamestate'
import { THRESHOLDS } from './thresholds'
import { clampScore, firstAvailable, itemName, selfIsPhysical } from './helpers'
import type { Rule, RuleOutput } from './types'

const ANTITANK_PHYSICAL = [3036, 6694] as const // LDR, Serylda
const ANTITANK_PHYSICAL_HP = [3153] as const // BotRK vs HP stackers
const ANTITANK_MAGIC = [3135, 6653] as const // Void Staff, Liandry

function effectiveHp(player: PlayerState): number {
  const { hp, armor, magicResist } = player.estimatedStats
  return hp * (1 + (armor + magicResist) / 2 / 100)
}

/**
 * Rule 3 — anti-tank: enemy team (or a single raid boss) over the effective-HP
 * baseline → % pen / BotRK / Liandry per own damage type.
 */
export const antiTankRule: Rule = (state, staticData) => {
  const baseline =
    THRESHOLDS.TANK_BASELINE_BASE + THRESHOLDS.TANK_BASELINE_PER_S * state.gameTimeS
  const teamTanky =
    state.enemyAggregates.tankinessIndex >= baseline * THRESHOLDS.TANK_TEAM_FACTOR
  const raidBosses = state.enemies
    .filter((enemy) => effectiveHp(enemy) >= baseline * THRESHOLDS.TANK_SOLO_FACTOR)
    .sort((a, b) => effectiveHp(b) - effectiveHp(a))
  if (!teamTanky && raidBosses.length === 0) return []

  const physical = selfIsPhysical(state)
  // HP stacking (low resists, big HP) → BotRK bites harder than %armor pen.
  const hpStacking =
    raidBosses.length > 0 &&
    raidBosses.every((boss) => boss.estimatedStats.armor + boss.estimatedStats.magicResist < 200)
  const options = physical
    ? hpStacking
      ? [...ANTITANK_PHYSICAL_HP, ...ANTITANK_PHYSICAL]
      : ANTITANK_PHYSICAL
    : ANTITANK_MAGIC
  const pick = firstAvailable(staticData, options)
  if (pick === null) return []

  const reasons: string[] = []
  if (teamTanky) {
    reasons.push(
      `HP efectiva media enemiga ${String(Math.round(state.enemyAggregates.tankinessIndex))} (esperada a este minuto: ~${String(Math.round(baseline))})`
    )
  }
  for (const boss of raidBosses.slice(0, 2)) {
    reasons.push(
      `${boss.championName} acumula ${String(Math.round(effectiveHp(boss)))} de HP efectiva (nivel ${String(boss.level)} + ${String(boss.items.filter((i) => i.isCompleted).length)} objetos)`
    )
  }
  reasons.push(
    `${physical ? 'Penetración/daño % con' : 'Penetración mágica con'} ${options
      .map((id) => itemName(staticData, id))
      .join(' / ')}`
  )

  const intensity = raidBosses.length > 0 ? effectiveHp(raidBosses[0] as PlayerState) / baseline : state.enemyAggregates.tankinessIndex / baseline
  const output: RuleOutput = {
    ruleId: 'anti-tank',
    itemId: pick,
    category: 'anti-tanque',
    action: 'add',
    score: clampScore(35 + (intensity - 1) * 60),
    reasons
  }
  return [output]
}
