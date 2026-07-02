/** Output of the rules engine. Reasons are mandatory — explainability is the product. */
export type RecommendationAction = 'prioritize' | 'add' | 'delay'

export interface Recommendation {
  /** Concrete item, when the rule points at one. */
  itemId: number | null
  itemName: string | null
  /** Coarse category when no single item applies (e.g. "armadura"). */
  category: string | null
  action: RecommendationAction
  /** 0-100, combined across rules. */
  score: number
  /** Spanish, concrete, with numbers. Never empty. */
  reasons: string[]
}
