import type { PlayerState } from '@shared/gamestate'
import { THRESHOLDS } from './thresholds'
import { clampScore, itemName, kdaLabel, ownsAny } from './helpers'
import type { Rule, RuleOutput } from './types'

const ZHONYA = 3157
const GUARDIAN_ANGEL = 3026
const BANSHEE = 3102
const MERCURIAL = 3139
const DEFENSIVES = [ZHONYA, GUARDIAN_ANGEL, BANSHEE, MERCURIAL]

/** Champion classes whose lead translates into one-shot threat. */
const BURST_TAGS = new Set(['Assassin', 'Mage'])

function isFedBurst(enemy: PlayerState, tags: string[]): boolean {
  const kdDiff = enemy.scores.kills - enemy.scores.deaths
  return (
    tags.some((tag) => BURST_TAGS.has(tag)) &&
    kdDiff >= THRESHOLDS.FED_KD_DIFF &&
    enemy.scores.kills >= THRESHOLDS.FED_MIN_KILLS
  )
}

/**
 * Rule 4 — anti-burst: a fed assassin/burst mage threatens self →
 * stasis/revive/cleanse class suggestion matched to the threat's damage type.
 */
export const antiBurstRule: Rule = (state, staticData) => {
  if (ownsAny(state.self, DEFENSIVES)) return []

  const threats = state.enemies.filter((enemy) =>
    isFedBurst(enemy, staticData.champions.get(enemy.championId)?.tags ?? [])
  )
  if (threats.length === 0) return []

  const worst = threats.sort(
    (a, b) => b.scores.kills - b.scores.deaths - (a.scores.kills - a.scores.deaths)
  )[0] as PlayerState

  // Self AP → Zhonya covers both; self AD → GA vs AD threat, Mercurial/Banshee vs AP.
  const selfIsAp = state.self.stats.abilityPower > state.self.stats.attackDamage
  const threatIsPhysical = worst.damageType === 'physical'
  const pick = selfIsAp ? ZHONYA : threatIsPhysical ? GUARDIAN_ANGEL : MERCURIAL

  const kdDiff = worst.scores.kills - worst.scores.deaths
  const output: RuleOutput = {
    ruleId: 'anti-burst',
    itemId: pick,
    category: 'supervivencia',
    action: 'add',
    score: clampScore(45 + (kdDiff - THRESHOLDS.FED_KD_DIFF) * 8 + (threats.length - 1) * 10),
    reasons: [
      `${kdaLabel(worst)} va fed (+${String(kdDiff)}) y su burst ${threatIsPhysical ? 'físico' : 'mágico'} te mata sin respuesta`,
      `${itemName(staticData, pick)} te da una ventana de supervivencia contra su patrón de entrada`,
      ...(threats.length > 1
        ? [`Amenazas adicionales: ${threats.slice(1).map(kdaLabel).join(', ')}`]
        : [])
    ]
  }
  return [output]
}
