import { z } from 'zod'

/**
 * Schemas for LCU payloads.
 *
 * POLICY: champ select must never expose player identities (ranked champ
 * select is anonymized by design). These schemas use plain z.object(), which
 * STRIPS unknown keys — identity fields (puuid, summonerId, gameName, ...)
 * present in the raw payload are actively removed, not just ignored.
 */

const champSelectAllySchema = z.object({
  cellId: z.number(),
  championId: z.number(),
  championPickIntent: z.number().optional(),
  assignedPosition: z.string().optional()
})

/** Enemy entries: champion only — even fewer fields than allies. */
const champSelectEnemySchema = z.object({
  cellId: z.number(),
  championId: z.number()
})

export const champSelectSessionSchema = z.object({
  localPlayerCellId: z.number(),
  myTeam: z.array(champSelectAllySchema),
  theirTeam: z.array(champSelectEnemySchema).optional().default([]),
  bans: z
    .object({
      myTeamBans: z.array(z.number()).optional().default([]),
      theirTeamBans: z.array(z.number()).optional().default([])
    })
    .optional()
    .default({ myTeamBans: [], theirTeamBans: [] }),
  timer: z
    .object({
      phase: z.string().optional()
    })
    .optional()
})

export type ChampSelectSession = z.infer<typeof champSelectSessionSchema>

/** Sanitized champ select state pushed to the renderer. */
export interface ChampSelectState {
  localPlayerCellId: number
  ownPosition: string | null
  /** Ally picks/intents: championId 0 = not picked yet. */
  myTeam: { cellId: number; championId: number; championPickIntent: number; position: string }[]
  theirTeam: { cellId: number; championId: number }[]
  bans: { mine: number[]; theirs: number[] }
  timerPhase: string | null
}

export function sanitizeChampSelect(raw: unknown): ChampSelectState | null {
  const parsed = champSelectSessionSchema.safeParse(raw)
  if (!parsed.success) return null
  const session = parsed.data
  const own = session.myTeam.find((member) => member.cellId === session.localPlayerCellId)
  return {
    localPlayerCellId: session.localPlayerCellId,
    ownPosition: own?.assignedPosition ?? null,
    myTeam: session.myTeam.map((member) => ({
      cellId: member.cellId,
      championId: member.championId,
      championPickIntent: member.championPickIntent ?? 0,
      position: member.assignedPosition ?? ''
    })),
    theirTeam: session.theirTeam.map((member) => ({
      cellId: member.cellId,
      championId: member.championId
    })),
    bans: {
      mine: session.bans.myTeamBans,
      theirs: session.bans.theirTeamBans
    },
    timerPhase: session.timer?.phase ?? null
  }
}

export const gameflowPhaseSchema = z.string()
