import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { allGameDataSchema } from '@shared/schemas/liveclient'

const samplePath = join(import.meta.dirname, '..', '..', 'fixtures', 'liveclientdata_sample.json')
const sample: unknown = JSON.parse(readFileSync(samplePath, 'utf8'))

describe('allGameDataSchema', () => {
  it('parses the official Riot sample payload with zero errors', () => {
    const result = allGameDataSchema.safeParse(sample)
    if (!result.success) {
      throw new Error(result.error.message)
    }
    expect(result.data.gameData.gameMode).toBe('CLASSIC')
    expect(result.data.allPlayers[0]?.championName).toBe('Annie')
    expect(result.data.activePlayer.level).toBe(1)
  })

  it('tolerates unknown fields (client patch additions)', () => {
    const patched = structuredClone(sample) as Record<string, unknown>
    patched['someFutureField'] = { nested: true }
    ;(patched['gameData'] as Record<string, unknown>)['newFlag'] = 1
    expect(allGameDataSchema.safeParse(patched).success).toBe(true)
  })

  it('validates optional scoreboard health when the client provides it', () => {
    const withHealth = structuredClone(sample) as { allPlayers: Record<string, unknown>[] }
    const player = withHealth.allPlayers[0]
    if (player === undefined) throw new Error('fixture missing player')
    player['currentHealth'] = 575
    player['maxHealth'] = 700
    const result = allGameDataSchema.safeParse(withHealth)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.allPlayers[0]?.currentHealth).toBe(575)

    player['currentHealth'] = 'hidden'
    expect(allGameDataSchema.safeParse(withHealth).success).toBe(false)
  })

  it('rejects a payload missing gameData', () => {
    const broken = structuredClone(sample) as Record<string, unknown>
    delete broken['gameData']
    expect(allGameDataSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects a player without championName', () => {
    const broken = structuredClone(sample) as {
      allPlayers: Record<string, unknown>[]
    }
    delete broken.allPlayers[0]?.['championName']
    expect(allGameDataSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects an empty player list', () => {
    const broken = structuredClone(sample) as { allPlayers: unknown[] }
    broken.allPlayers = []
    expect(allGameDataSchema.safeParse(broken).success).toBe(false)
  })
})
