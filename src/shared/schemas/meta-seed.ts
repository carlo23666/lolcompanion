import { z } from 'zod'

/**
 * Shareable Master+ aggregate seed (meta-seed.json.gz, published as a GitHub
 * release asset). Pure anonymous aggregates + the match-id ledger so a later
 * crawl on the importing machine never double-counts. External payload →
 * validated like any other untrusted input.
 */
const statRow = {
  champion: z.string().min(1),
  role: z.string(),
  games: z.number().int().positive(),
  wins: z.number().int().nonnegative()
}

export const metaSeedSchema = z.object({
  version: z.literal(1),
  patch: z.string().min(1),
  exportedAt: z.string(),
  matchIds: z.array(z.string().min(1)),
  championStats: z.array(z.object(statRow)),
  matchups: z.array(z.object({ ...statRow, enemyChampion: z.string().min(1) })),
  items: z.array(z.object({ ...statRow, itemId: z.number().int().positive() }))
})

export type MetaSeed = z.infer<typeof metaSeedSchema>
