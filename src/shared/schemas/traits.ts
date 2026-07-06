import { z } from 'zod'

/**
 * Hand-curated champion traits for champ-select signals, keyed by ddragon id.
 * Coverage is deliberately partial (marksmen + owner pool): a missing entry
 * means "no signal", never "zero". Scale 0-2:
 * - mobility: 0 immobile (Jinx, Kog'Maw) · 1 some tool (Caitlyn net) ·
 *   2 real dashes/blinks (Ezreal, Kai'Sa, Lucian).
 * - antiTank: 0 struggles into raw HP · 1 partial (%HP poke, executes) ·
 *   2 shreds tanks by kit (Vayne, Kog'Maw, Kai'Sa).
 */
export const championTraitsSchema = z.record(
  z.string(),
  z.object({
    mobility: z.number().int().min(0).max(2),
    antiTank: z.number().int().min(0).max(2)
  })
)

export type ChampionTraits = z.infer<typeof championTraitsSchema>
