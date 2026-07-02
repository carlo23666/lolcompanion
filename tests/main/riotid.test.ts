import { describe, expect, it } from 'vitest'
import { normalizeRiotId } from '@main/riot/riotid'

describe('normalizeRiotId', () => {
  it('strips BiDi isolate characters copied from the League client', () => {
    // Real-world capture (2026-07-02): copying the Riot ID from the client
    // wraps name and tag in U+2066 (LRI) / U+2069 (PDI).
    expect(normalizeRiotId('⁦Flαkked⁩#⁦EUW⁩')).toBe('Flαkked#EUW')
  })

  it('strips zero-width and BOM characters', () => {
    expect(normalizeRiotId('﻿Name​#‍TAG‌')).toBe('Name#TAG')
  })

  it('trims whitespace around name and tag', () => {
    expect(normalizeRiotId('  Name #TAG ')).toBe('Name#TAG')
  })

  it('preserves inner spaces and non-ASCII letters of the game name', () => {
    expect(normalizeRiotId('Der Große Name#EUW')).toBe('Der Große Name#EUW')
  })

  it('keeps everything after the first # as the tag', () => {
    expect(normalizeRiotId('Na#me#TAG')).toBe('Na#me#TAG')
  })

  it('returns a trimmed string when there is no tag separator', () => {
    expect(normalizeRiotId(' SoloName ')).toBe('SoloName')
  })
})
