import type { GameState } from '@shared/gamestate'
import type { RecommendationAction } from '@shared/recommendation'
import type { Translator } from '@shared/i18n'
import type { StaticData } from '../../staticdata/manager'
import type { MetaItemsInput } from '../meta-items'

export interface RuleOutput {
  ruleId: string
  itemId?: number
  category?: string
  action: RecommendationAction
  /** 0-100 before combining. */
  score: number
  /** Spanish, concrete, with numbers. */
  reasons: string[]
}

/**
 * Rules receive the champion's Master+ item distribution: situational picks
 * must come from what Master+ players actually build on this champion, and
 * anything they don't back ships capped (SUGGESTION_SCORE_CAP) and labeled.
 */
export type Rule = (
  state: GameState,
  staticData: StaticData,
  meta?: MetaItemsInput,
  /** Locale-bound translator; defaults to Spanish when omitted (ADR-009). */
  t?: Translator
) => RuleOutput[]
