import { z } from 'zod'

/**
 * Schemas for Data Dragon static files (item.json, champion.json,
 * runesReforged.json). External payloads → validated loosely: required fields
 * checked, unknown fields tolerated across patches.
 */

export const ddItemSchema = z.looseObject({
  name: z.string(),
  from: z.array(z.string()).optional(),
  into: z.array(z.string()).optional(),
  gold: z.looseObject({
    base: z.number(),
    total: z.number(),
    sell: z.number(),
    purchasable: z.boolean()
  }),
  tags: z.array(z.string()),
  maps: z.record(z.string(), z.boolean()),
  stats: z.record(z.string(), z.number()),
  depth: z.number().optional(),
  plaintext: z.string().optional(),
  description: z.string().optional(),
  consumed: z.boolean().optional(),
  inStore: z.boolean().optional(),
  requiredChampion: z.string().optional(),
  requiredAlly: z.string().optional(),
  image: z.looseObject({ full: z.string() }).optional()
})

export const itemFileSchema = z.looseObject({
  version: z.string(),
  data: z.record(z.string(), ddItemSchema)
})

export const ddChampionStatsSchema = z.looseObject({
  hp: z.number(),
  hpperlevel: z.number(),
  mp: z.number(),
  mpperlevel: z.number(),
  movespeed: z.number(),
  armor: z.number(),
  armorperlevel: z.number(),
  spellblock: z.number(),
  spellblockperlevel: z.number(),
  attackrange: z.number(),
  hpregen: z.number(),
  hpregenperlevel: z.number(),
  crit: z.number(),
  critperlevel: z.number(),
  attackdamage: z.number(),
  attackdamageperlevel: z.number(),
  attackspeed: z.number(),
  attackspeedperlevel: z.number()
})

export const ddChampionSchema = z.looseObject({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  title: z.string().optional(),
  tags: z.array(z.string()),
  partype: z.string().optional(),
  stats: ddChampionStatsSchema,
  image: z.looseObject({ full: z.string() }).optional()
})

export const championFileSchema = z.looseObject({
  version: z.string(),
  data: z.record(z.string(), ddChampionSchema)
})

export const runeSchema = z.looseObject({
  id: z.number(),
  key: z.string(),
  name: z.string(),
  icon: z.string().optional()
})

export const runeTreeSchema = z.looseObject({
  id: z.number(),
  key: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  slots: z.array(z.looseObject({ runes: z.array(runeSchema) }))
})

export const runesFileSchema = z.array(runeTreeSchema)

export const versionsFileSchema = z.array(z.string()).min(1)

export type DdItem = z.infer<typeof ddItemSchema>
export type DdChampion = z.infer<typeof ddChampionSchema>
export type DdChampionStats = z.infer<typeof ddChampionStatsSchema>
export type RuneTree = z.infer<typeof runeTreeSchema>
