import type { PlayerState } from '@shared/gamestate'
import { THRESHOLDS } from './thresholds'
import { availableOptions, clampScore, itemName, ownsAny, selfIsPhysical } from './helpers'
import type { Rule } from './types'

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
  const options = availableOptions(
    staticData,
    physical
      ? hpStacking
        ? [...ANTITANK_PHYSICAL_HP, ...ANTITANK_PHYSICAL]
        : ANTITANK_PHYSICAL
      : ANTITANK_MAGIC
  )
  // Owning any anti-tank option means the advice is covered — stacking a
  // second %pen item is rarely right and the alert must clear once bought.
  if (options.length === 0 || ownsAny(state.self, options)) return []

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
  const score = clampScore(35 + (intensity - 1) * 60)
  // One output per option (shared reasons) so the UI can show alternatives;
  // the preferred option ranks first.
  return options.map((itemId, index) => ({
    ruleId: 'anti-tank',
    itemId,
    category: 'anti-tanque',
    action: 'add' as const,
    score: clampScore(score - index * 8),
    reasons
  }))
}
