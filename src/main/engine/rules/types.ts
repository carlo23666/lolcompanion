import type { GameState } from '@shared/gamestate'
import type { RecommendationAction } from '@shared/recommendation'
import type { StaticData } from '../../staticdata/manager'

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

export type Rule = (state: GameState, staticData: StaticData) => RuleOutput[]
