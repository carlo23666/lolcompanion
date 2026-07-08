import type { PlayerState } from '@shared/gamestate'
import {
  metaPickReason,
  metaPreferred,
  metaTrusted,
  SUGGESTION_SCORE_CAP,
  suggestionReason
} from '../meta-items'
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
 * item. The item comes from what Master+ players ACTUALLY build on this
 * champion (no more Zhonya on ADCs); the class heuristic only breaks the tie
 * when there is no meta signal, and then the advice ships capped + labeled.
 */
export const antiBurstRule: Rule = (state, staticData, meta, t = defaultTranslator) => {
  if (ownsAny(state.self, DEFENSIVES)) return []

  const threats = state.enemies.filter((enemy) =>
    isFedBurst(enemy, staticData.champions.get(enemy.championId)?.tags ?? [])
  )
  if (threats.length === 0) return []

  const worst = threats.sort(
    (a, b) => b.scores.kills - b.scores.deaths - (a.scores.kills - a.scores.deaths)
  )[0] as PlayerState
  const kdDiff = worst.scores.kills - worst.scores.deaths
  const threatIsPhysical = worst.damageType === 'physical'

  // Master+ first: the defensive this champion's players actually buy.
  const metaPick = metaPreferred(meta, DEFENSIVES)
  let pick: number
  let capped = false
  const metaReasons: string[] = []
  if (metaPick !== null) {
    pick = metaPick.itemId
    metaReasons.push(
      metaPickReason(state.self.championName, itemName(staticData, pick), metaPick, t)
    )
  } else {
    // No signal → class heuristic; with a trusted sample that says "nobody
    // builds these on this champion", it is only a capped suggestion.
    const selfIsAp = state.self.stats.abilityPower > state.self.stats.attackDamage
    pick = selfIsAp ? ZHONYA : threatIsPhysical ? GUARDIAN_ANGEL : MERCURIAL
    if (metaTrusted(meta)) {
      capped = true
      metaReasons.push(suggestionReason(state.self.championName, t))
    }
  }

  let score = clampScore(45 + (kdDiff - THRESHOLDS.FED_KD_DIFF) * 8 + (threats.length - 1) * 10)
  if (capped) score = Math.min(score, SUGGESTION_SCORE_CAP)

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
