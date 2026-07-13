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
  // v2 adds itemOrder; v3 adds coherent buildRoutes. Older seeds remain importable.
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  patch: z.string().min(1),
  exportedAt: z.string(),
  matchIds: z.array(z.string().min(1)),
  championStats: z.array(z.object(statRow)),
  matchups: z.array(z.object({ ...statRow, enemyChampion: z.string().min(1) })),
  items: z.array(z.object({ ...statRow, itemId: z.number().int().positive() })),
  /** Item completion-order aggregates (v2). */
  itemOrder: z
    .array(
      z.object({
        champion: z.string().min(1),
        role: z.string(),
        itemId: z.number().int().positive(),
        games: z.number().int().positive(),
        slotSum: z.number().int().nonnegative(),
        firstGames: z.number().int().nonnegative()
      })
    )
    .optional(),
  /** Starter + ordered finished-item route aggregates (v3). */
  buildRoutes: z
    .array(
      z.object({
        champion: z.string().min(1),
        role: z.string(),
        starterId: z.number().int().nonnegative(),
        route: z.string().regex(/^\d+(,\d+)*$/),
        games: z.number().int().positive(),
        wins: z.number().int().nonnegative()
      })
    )
    .optional()
})

export type MetaSeed = z.infer<typeof metaSeedSchema>
