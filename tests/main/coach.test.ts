import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChampSelectInsights } from '@shared/champselect'
import type { PostGameReport } from '@shared/report'
import { buildCoachPrompt, buildDraftPrompt, generateCoachAdvice, ollamaStatus } from '@main/coach'

const report: PostGameReport = {
  matchId: 'EUW1_1',
  champion: 'Jinx',
  win: true,
  durationS: 1860,
  kills: 9,
  deaths: 4,
  assists: 7,
  csPerMin: 7.4,
  goldPerMin: 420,
  damageSharePct: 31,
  visionScore: 14,
  avgCsPerMin: 6.9,
  avgGoldPerMin: 400,
  avgDamageSharePct: 28,
  avgDeaths: 5.2,
  avgVisionScore: 16,
  recommendedItems: [
    { itemId: 3031, itemName: 'Filo Infinito', followed: true },
    { itemId: 3036, itemName: 'Recordatorio Mortal', followed: false }
  ],
  summary: ['Buena farmeada']
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildCoachPrompt', () => {
  it('embeds every fact and the anti-hallucination frame', () => {
    const prompt = buildCoachPrompt(report)
    expect(prompt).toContain('Jinx')
    expect(prompt).toContain('victoria')
    expect(prompt).toContain('9/4/7')
    expect(prompt).toContain('Filo Infinito')
    expect(prompt).toContain('PROHIBIDO inventar')
    expect(prompt).toContain('español')
  })
})

describe('buildDraftPrompt', () => {
  it('embeds picks, tips and the anti-hallucination frame', () => {
    const insights: ChampSelectInsights = {
      enemySplit: { physical: 3, magic: 1, mixed: 0, picked: 4 },
      allySplit: { physical: 2, magic: 1, mixed: 0, picked: 3 },
      tips: ['Comp enemiga muy AD: Ángel de la Guarda encaja contigo'],
      picks: [
        {
          championId: 'Kaisa',
          name: "Kai'Sa",
          games: 20,
          winratePct: 60,
          reasons: ['60% de victorias', '2 tanques enfrente: tu daño por % de vida los derrite']
        }
      ],
      ownPlan: null
    }
    const prompt = buildDraftPrompt(insights)
    expect(prompt).toContain("Kai'Sa")
    expect(prompt).toContain('% de vida')
    expect(prompt).toContain('Ángel de la Guarda')
    expect(prompt).toContain('PROHIBIDO mencionar')
    expect(prompt).toContain('selección de campeones')
  })
})

describe('ollamaStatus', () => {
  it('reports availability and model list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ models: [{ name: 'gemma3:4b' }, { name: 'llama3.2' }] }))
      )
    )
    expect(await ollamaStatus()).toEqual({ available: true, models: ['gemma3:4b', 'llama3.2'] })
  })

  it('is unavailable when nothing listens on the port', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    expect(await ollamaStatus()).toEqual({ available: false, models: [] })
  })
})

describe('generateCoachAdvice', () => {
  it('returns trimmed model text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ response: '  Buen CS esta partida.  ' })))
    vi.stubGlobal('fetch', fetchMock)
    const result = await generateCoachAdvice('gemma3:4b', 'prompt')
    expect(result).toEqual({ ok: true, text: 'Buen CS esta partida.' })
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      model: string
      stream: boolean
    }
    expect(body.model).toBe('gemma3:4b')
    expect(body.stream).toBe(false)
  })

  it('maps failures to Spanish-friendly errors instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 404 })))
    const notFound = await generateCoachAdvice('missing-model', 'prompt')
    expect(notFound.ok).toBe(false)

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    const dead = await generateCoachAdvice('gemma3:4b', 'prompt')
    expect(dead).toEqual({
      ok: false,
      error: 'No se pudo hablar con Ollama: timeout'
    })
  })
})
