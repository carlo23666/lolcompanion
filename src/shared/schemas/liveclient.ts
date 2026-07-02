import { z } from 'zod'

/**
 * Schemas for the Live Client Data API (`https://127.0.0.1:2999`).
 * External payload → untrusted input: required fields are validated, unknown
 * fields are tolerated (loose objects) so client patches don't break parsing.
 *
 * Identity fields (summonerName/riotId) are parsed because the API returns
 * them for the player's OWN game (visible on screen — policy-compliant), and
 * the anonymizer needs to locate them in recorded fixtures. They must never be
 * surfaced outside the player's own live game context.
 */

const runeSchema = z.looseObject({
  id: z.number(),
  displayName: z.string().optional()
})

const abilitySchema = z.looseObject({
  id: z.string().optional(),
  displayName: z.string().optional(),
  abilityLevel: z.number().optional()
})

export const championStatsSchema = z.looseObject({
  abilityPower: z.number(),
  armor: z.number(),
  attackDamage: z.number(),
  attackRange: z.number(),
  attackSpeed: z.number(),
  critChance: z.number(),
  critDamage: z.number(),
  currentHealth: z.number(),
  magicResist: z.number(),
  maxHealth: z.number(),
  moveSpeed: z.number(),
  resourceMax: z.number(),
  resourceType: z.string(),
  resourceValue: z.number(),
  armorPenetrationFlat: z.number().optional(),
  armorPenetrationPercent: z.number().optional(),
  magicPenetrationFlat: z.number().optional(),
  magicPenetrationPercent: z.number().optional(),
  lifeSteal: z.number().optional(),
  spellVamp: z.number().optional(),
  tenacity: z.number().optional(),
  healthRegenRate: z.number().optional()
})

export const activePlayerSchema = z.looseObject({
  currentGold: z.number(),
  level: z.number(),
  championStats: championStatsSchema,
  summonerName: z.string().optional(),
  riotId: z.string().optional(),
  riotIdGameName: z.string().optional(),
  riotIdTagLine: z.string().optional(),
  abilities: z.record(z.string(), abilitySchema).optional(),
  fullRunes: z
    .looseObject({
      keystone: runeSchema.optional(),
      generalRunes: z.array(runeSchema).optional(),
      statRunes: z.array(runeSchema).optional(),
      primaryRuneTree: runeSchema.optional(),
      secondaryRuneTree: runeSchema.optional()
    })
    .optional()
})

export const playerItemSchema = z.looseObject({
  itemID: z.number(),
  count: z.number(),
  slot: z.number().optional(),
  displayName: z.string().optional(),
  price: z.number().optional(),
  canUse: z.boolean().optional(),
  consumable: z.boolean().optional()
})

export const playerSchema = z.looseObject({
  championName: z.string(),
  team: z.enum(['ORDER', 'CHAOS']),
  level: z.number(),
  isBot: z.boolean(),
  isDead: z.boolean(),
  respawnTimer: z.number(),
  position: z.string().optional(),
  items: z.array(playerItemSchema),
  scores: z.looseObject({
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
    creepScore: z.number(),
    wardScore: z.number()
  }),
  summonerName: z.string().optional(),
  riotId: z.string().optional(),
  riotIdGameName: z.string().optional(),
  riotIdTagLine: z.string().optional(),
  skinID: z.number().optional(),
  rawChampionName: z.string().optional(),
  runes: z
    .looseObject({
      keystone: runeSchema.optional(),
      primaryRuneTree: runeSchema.optional(),
      secondaryRuneTree: runeSchema.optional()
    })
    .optional(),
  summonerSpells: z
    .looseObject({
      summonerSpellOne: z.looseObject({ displayName: z.string().optional() }).optional(),
      summonerSpellTwo: z.looseObject({ displayName: z.string().optional() }).optional()
    })
    .optional()
})

export const gameEventSchema = z.looseObject({
  EventID: z.number(),
  EventName: z.string(),
  EventTime: z.number()
})

export const gameDataSchema = z.looseObject({
  gameMode: z.string(),
  gameTime: z.number(),
  mapName: z.string().optional(),
  mapNumber: z.number().optional(),
  mapTerrain: z.string().optional()
})

export const allGameDataSchema = z.looseObject({
  activePlayer: activePlayerSchema,
  allPlayers: z.array(playerSchema).min(1),
  events: z.looseObject({ Events: z.array(gameEventSchema) }),
  gameData: gameDataSchema
})

export type LiveClientSnapshot = z.infer<typeof allGameDataSchema>
export type LiveClientPlayer = z.infer<typeof playerSchema>
export type LiveClientActivePlayer = z.infer<typeof activePlayerSchema>
export type LiveClientEvent = z.infer<typeof gameEventSchema>
