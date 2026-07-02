import { z } from 'zod'

/**
 * Schemas for the Riot Web API (account-v1, match-v5, league-v4).
 * Loose objects: required fields validated, unknown fields tolerated.
 */

export const accountSchema = z.looseObject({
  puuid: z.string(),
  gameName: z.string().optional(),
  tagLine: z.string().optional()
})

export const matchIdsSchema = z.array(z.string())

export const matchParticipantSchema = z.looseObject({
  puuid: z.string(),
  championName: z.string(),
  championId: z.number().optional(),
  teamId: z.number(),
  teamPosition: z.string().optional(),
  win: z.boolean(),
  kills: z.number(),
  deaths: z.number(),
  assists: z.number(),
  totalMinionsKilled: z.number(),
  neutralMinionsKilled: z.number().optional(),
  goldEarned: z.number(),
  totalDamageDealtToChampions: z.number(),
  visionScore: z.number().optional(),
  item0: z.number(),
  item1: z.number(),
  item2: z.number(),
  item3: z.number(),
  item4: z.number(),
  item5: z.number(),
  item6: z.number(),
  riotIdGameName: z.string().optional(),
  riotIdTagline: z.string().optional(),
  summonerName: z.string().optional()
})

export const matchSchema = z.looseObject({
  metadata: z.looseObject({
    matchId: z.string(),
    participants: z.array(z.string())
  }),
  info: z.looseObject({
    queueId: z.number(),
    gameVersion: z.string(),
    gameCreation: z.number(),
    gameDuration: z.number(),
    gameMode: z.string().optional(),
    participants: z.array(matchParticipantSchema)
  })
})

export const timelineEventSchema = z.looseObject({
  type: z.string(),
  timestamp: z.number(),
  participantId: z.number().optional(),
  itemId: z.number().optional(),
  killerId: z.number().optional(),
  victimId: z.number().optional(),
  skillSlot: z.number().optional(),
  level: z.number().optional(),
  monsterType: z.string().optional(),
  monsterSubType: z.string().optional(),
  buildingType: z.string().optional(),
  teamId: z.number().optional()
})

export const participantFrameSchema = z.looseObject({
  participantId: z.number(),
  totalGold: z.number(),
  currentGold: z.number(),
  level: z.number(),
  xp: z.number(),
  minionsKilled: z.number(),
  jungleMinionsKilled: z.number()
})

export const timelineFrameSchema = z.looseObject({
  timestamp: z.number(),
  participantFrames: z.record(z.string(), participantFrameSchema),
  events: z.array(timelineEventSchema)
})

export const timelineSchema = z.looseObject({
  metadata: z.looseObject({
    matchId: z.string(),
    participants: z.array(z.string())
  }),
  info: z.looseObject({
    frameInterval: z.number().optional(),
    frames: z.array(timelineFrameSchema),
    participants: z
      .array(z.looseObject({ participantId: z.number(), puuid: z.string() }))
      .optional()
  })
})

export const leagueEntrySchema = z.looseObject({
  queueType: z.string(),
  tier: z.string().optional(),
  rank: z.string().optional(),
  leaguePoints: z.number().optional(),
  wins: z.number().optional(),
  losses: z.number().optional()
})

export const leagueEntriesSchema = z.array(leagueEntrySchema)

export type RiotAccount = z.infer<typeof accountSchema>
export type RiotMatch = z.infer<typeof matchSchema>
export type RiotMatchParticipant = z.infer<typeof matchParticipantSchema>
export type RiotTimeline = z.infer<typeof timelineSchema>
export type RiotTimelineFrame = z.infer<typeof timelineFrameSchema>
export type RiotTimelineEvent = z.infer<typeof timelineEventSchema>
export type RiotLeagueEntry = z.infer<typeof leagueEntrySchema>
