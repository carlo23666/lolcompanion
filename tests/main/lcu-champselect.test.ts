import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { sanitizeChampSelect } from '@shared/schemas/lcu'

const fixturePath = join(
  import.meta.dirname,
  '..',
  '..',
  'fixtures',
  'lcu',
  'champselect-session.json'
)
const rawSession: unknown = JSON.parse(readFileSync(fixturePath, 'utf8'))

describe('sanitizeChampSelect', () => {
  it('parses the fixture and extracts picks, bans and own position', () => {
    const state = sanitizeChampSelect(rawSession)
    expect(state).not.toBeNull()
    expect(state?.localPlayerCellId).toBe(2)
    expect(state?.ownPosition).toBe('middle')
    expect(state?.myTeam).toHaveLength(5)
    expect(state?.myTeam[0]).toEqual({
      cellId: 0,
      championId: 266,
      championPickIntent: 0,
      position: 'top'
    })
    // Own pick intent (Ahri, 103) while championId is still 0.
    expect(state?.myTeam[2]?.championPickIntent).toBe(103)
    expect(state?.theirTeam.map((enemy) => enemy.championId)).toEqual([157, 238, 0, 51, 89])
    expect(state?.bans).toEqual({ mine: [266, 875], theirs: [103, 84] })
    expect(state?.timerPhase).toBe('BAN_PICK')
  })

  it('POLICY: strips every identity field from the payload', () => {
    const state = sanitizeChampSelect(rawSession)
    const serialized = JSON.stringify(state)
    expect(serialized).not.toContain('SHOULD_NOT_LEAK')
    expect(serialized).not.toContain('puuid')
    expect(serialized).not.toContain('summonerId')
    expect(serialized).not.toContain('gameName')
    expect(serialized).not.toContain('tagLine')
    expect(serialized).not.toContain('obfuscated')
  })

  it('returns null for malformed payloads instead of throwing', () => {
    expect(sanitizeChampSelect(null)).toBeNull()
    expect(sanitizeChampSelect({})).toBeNull()
    expect(sanitizeChampSelect({ localPlayerCellId: 'x', myTeam: [] })).toBeNull()
  })

  it('tolerates missing optional blocks (bans/timer/theirTeam)', () => {
    const minimal = {
      localPlayerCellId: 0,
      myTeam: [{ cellId: 0, championId: 1 }]
    }
    const state = sanitizeChampSelect(minimal)
    expect(state?.bans).toEqual({ mine: [], theirs: [] })
    expect(state?.theirTeam).toEqual([])
    expect(state?.timerPhase).toBeNull()
  })
})
