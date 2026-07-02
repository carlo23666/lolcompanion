import { z } from 'zod'

/** Schema for src/main/engine/baselines/pool.json (curated, but still validated). */

export const baselineChampionSchema = z.object({
  championId: z.string().min(1),
  role: z.enum(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']),
  /** Ordered completed-item core build. */
  core: z.array(z.number().int().positive()).min(2),
  /** Situational swaps the rules can promote. */
  situational: z.array(z.number().int().positive()),
  runePageName: z.string().optional()
})

export const baselinePoolSchema = z.object({
  champions: z.array(baselineChampionSchema).min(1)
})

export type BaselineChampion = z.infer<typeof baselineChampionSchema>
export type BaselinePool = z.infer<typeof baselinePoolSchema>
