/** Output of the rules engine. Reasons are mandatory — explainability is the product. */
export type RecommendationAction = 'prioritize' | 'add' | 'delay' | 'replace'

export type RecommendationKind = 'route' | 'adaptation' | 'economy'

export interface RecommendationPlan {
  source: 'meta-route' | 'meta-inferred' | 'personal-route' | 'pool'
  /** 0..1, based on route and champion+role sample size. */
  confidence: number
  steps: { itemId: number; itemName: string; owned: boolean }[]
  currentStep: number
  /** Non-boots power-spike items still protected from ordinary deviations. */
  protectedCoreRemaining: number
  personalAdjusted: boolean
  damageAdjusted: boolean
}

export interface Recommendation {
  /** Concrete item, when the rule points at one. */
  itemId: number | null
  itemName: string | null
  /** Coarse category when no single item applies (e.g. "armadura"). */
  category: string | null
  action: RecommendationAction
  /** 0-100, combined across rules. */
  score: number
  /** Primary route vs a contextual option; absent on legacy stored rows. */
  kind?: RecommendationKind
  /** Route context for progressive disclosure in the renderer. */
  plan?: RecommendationPlan
  /** Spanish, concrete, with numbers. Never empty. */
  reasons: string[]
}
