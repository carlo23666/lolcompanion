import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { RiotClient } from '@main/riot/client'
import { RiotRateLimiter } from '@main/riot/limiter'

const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'riot')
const matchFixture = readFileSync(join(fixtureDir, 'match.json'), 'utf8')
const timelineFixture = readFileSync(join(fixtureDir, 'timeline.json'), 'utf8')

function makeClient(handler: (url: string) => Response): RiotClient {
  const fetchFn = vi.fn().mockImplementation((input: string | URL | Request) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    return Promise.resolve(handler(url))
  })
  return new RiotClient({
    apiKey: 'RGAPI-test-key',
    platform: 'euw1',
    limiter: new RiotRateLimiter({ methodLimits: {} }),
    fetchFn
  })
}

describe('RiotClient', () => {
  it('parses a match-v5 payload (fixture)', async () => {
    const client = makeClient(() => new Response(matchFixture))
    const result = await client.match('EUW1_7000000001')
    if (!result.ok) throw new Error(result.error.message)
    expect(result.value.metadata.matchId).toBe('EUW1_7000000001')
    expect(result.value.info.participants).toHaveLength(10)
    expect(result.value.info.participants[0]?.championName).toBe('Aatrox')
  })

  it('parses a timeline payload (fixture)', async () => {
    const client = makeClient(() => new Response(timelineFixture))
    const result = await client.timeline('EUW1_7000000001')
    if (!result.ok) throw new Error(result.error.message)
    expect(result.value.info.frames.length).toBe(31)
    expect(result.value.info.frames[10]?.participantFrames['3']?.totalGold).toBeGreaterThan(0)
  })

  it('routes account-v1 to the regional host and league-v4 to the platform host', async () => {
    const urls: string[] = []
    const client = makeClient((url) => {
      urls.push(url)
      if (url.includes('/riot/account/')) {
        return new Response(JSON.stringify({ puuid: 'PUUID_X' }))
      }
      return new Response('[]')
    })
    await client.accountByRiotId('Name', 'TAG')
    await client.leagueEntries('PUUID_X')
    expect(urls[0]).toContain('https://europe.api.riotgames.com/riot/account/v1/')
    expect(urls[1]).toContain('https://euw1.api.riotgames.com/lol/league/v4/')
  })

  it('maps 404 to a typed notFound error', async () => {
    const client = makeClient(() => new Response('{}', { status: 404 }))
    const result = await client.match('EUW1_missing')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('notFound')
  })

  it('rejects malformed payloads with invalidPayload (zod)', async () => {
    const client = makeClient(() => new Response(JSON.stringify({ metadata: {} })))
    const result = await client.match('EUW1_x')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('invalidPayload')
  })

  it('never leaks the API key in error messages', async () => {
    const client = makeClient(() => new Response('{}', { status: 500 }))
    const result = await client.match('EUW1_x')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).not.toContain('RGAPI-test-key')
  })
})
