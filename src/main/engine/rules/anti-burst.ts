import type { PlayerState } from '@shared/gamestate'
import { metaPickReason, metaPreferred } from '../meta-items'
import { THRESHOLDS } from './thresholds'
import { clampScore, defaultTranslator, itemName, kdaLabel, ownsAny } from './helpers'
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
 * Rule 4 — anti-burst: a fed assassin/burst mage threatens self → survival
 * item. The item is ONLY one this champion's Master+ players actually build
 * (WP-018): no meta-backed survival item on this champion → the rule stays
 * silent rather than invent Zhonya/GA on someone who never buys them.
 */
export const antiBurstRule: Rule = (state, staticData, meta, t = defaultTranslator) => {
  if (ownsAny(state.self, DEFENSIVES)) return []

  const threats = state.enemies.filter((enemy) =>
    isFedBurst(enemy, staticData.champions.get(enemy.championId)?.tags ?? [])
  )
  if (threats.length === 0) return []

  // Master+ anchor: the survival item this champion's players actually buy.
  const metaPick = metaPreferred(meta, DEFENSIVES)
  if (metaPick === null) return []
  const pick = metaPick.itemId
  const metaReasons = [metaPickReason(state.self.championName, itemName(staticData, pick), metaPick, t)]

  const worst = threats.sort(
    (a, b) => b.scores.kills - b.scores.deaths - (a.scores.kills - a.scores.deaths)
  )[0] as PlayerState
  const kdDiff = worst.scores.kills - worst.scores.deaths
  const threatIsPhysical = worst.damageType === 'physical'

  const score = clampScore(45 + (kdDiff - THRESHOLDS.FED_KD_DIFF) * 8 + (threats.length - 1) * 10)

  const output: RuleOutput = {
    ruleId: 'anti-burst',
    itemId: pick,
    category: t('engine.cat.survival'),
    action: 'add',
    score,
    reasons: [
      t('engine.antiburst.threat', {
        kda: kdaLabel(worst),
        diff: String(kdDiff),
        type: threatIsPhysical ? t('engine.word.physical') : t('engine.word.magic')
      }),
      t('engine.antiburst.window', { item: itemName(staticData, pick) }),
      ...metaReasons,
      ...(threats.length > 1
        ? [t('engine.antiburst.more', { threats: threats.slice(1).map(kdaLabel).join(', ') })]
        : [])
    ]
  }
  return [output]
}
