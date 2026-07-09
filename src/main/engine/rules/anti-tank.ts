import type { PlayerState } from '@shared/gamestate'
import { metaBackedOptions, metaPickReason, metaUsage } from '../meta-items'
import { THRESHOLDS } from './thresholds'
import {
  availableOptions,
  clampScore,
  defaultTranslator,
  itemName,
  ownsAny,
  selfIsPhysical
} from './helpers'
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
export const antiTankRule: Rule = (state, staticData, meta, t = defaultTranslator) => {
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
  // Master+ anchor (WP-018): only the %pen items this champion's Master+
  // players build, most-used first. No meta-backed option → this champion
  // never itemizes anti-tank (an enchanter never buys %pen): stay silent.
  const options = metaBackedOptions(
    availableOptions(
      staticData,
      physical
        ? hpStacking
          ? [...ANTITANK_PHYSICAL_HP, ...ANTITANK_PHYSICAL]
          : ANTITANK_PHYSICAL
        : ANTITANK_MAGIC
    ),
    meta
  )
  // Owning any anti-tank option means the advice is covered — stacking a
  // second %pen item is rarely right and the alert must clear once bought.
  if (options.length === 0 || ownsAny(state.self, options)) return []

  const reasons: string[] = []
  if (teamTanky) {
    reasons.push(
      t('engine.antitank.teamEhp', {
        ehp: String(Math.round(state.enemyAggregates.tankinessIndex)),
        baseline: String(Math.round(baseline))
      })
    )
  }
  for (const boss of raidBosses.slice(0, 2)) {
    reasons.push(
      t('engine.antitank.boss', {
        champion: boss.championName,
        ehp: String(Math.round(effectiveHp(boss))),
        level: String(boss.level),
        items: String(boss.items.filter((i) => i.isCompleted).length)
      })
    )
  }
  const penItems = options.map((id) => itemName(staticData, id)).join(' / ')
  reasons.push(
    physical
      ? t('engine.antitank.penPhysical', { items: penItems })
      : t('engine.antitank.penMagic', { items: penItems })
  )

  const intensity = raidBosses.length > 0 ? effectiveHp(raidBosses[0] as PlayerState) / baseline : state.enemyAggregates.tankinessIndex / baseline
  const score = clampScore(35 + (intensity - 1) * 60)
  // One output per option (shared reasons) so the UI can show alternatives;
  // the Master+-preferred option ranks first. Every option is meta-backed.
  return options.map((itemId, index) => {
    const stat = metaUsage(meta, itemId)
    return {
      ruleId: 'anti-tank',
      itemId,
      category: t('engine.cat.antitank'),
      action: 'add' as const,
      score: clampScore(score - index * 8),
      reasons: [
        ...reasons,
        ...(stat !== null
          ? [metaPickReason(state.self.championName, itemName(staticData, itemId), stat, t)]
          : [])
      ]
    }
  })
}
