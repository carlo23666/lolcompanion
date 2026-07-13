import { describe, expect, it } from 'vitest'
import type { GameState, GameStateEvent } from '@shared/gamestate'
import { buildLiveCoachPrompt, LiveCoach, type LiveCoachTip } from '@main/coach-live'
// (direction prompts are exercised through the class; builder export not needed here)
import midGameState from '../../fixtures/gamestate/mid.json'

const mid = midGameState as unknown as GameState

function stateAt(gameTimeS: number): GameState {
  return { ...structuredClone(mid), gameTimeS }
}

function makeCoach(options?: {
  enabled?: boolean
  generate?: (prompt: string) => Promise<{ ok: true; text: string } | { ok: false; error: string }>
}): { coach: LiveCoach; tips: LiveCoachTip[]; prompts: string[] } {
  const tips: LiveCoachTip[] = []
  const prompts: string[] = []
  const coach = new LiveCoach({
    isEnabled: () => options?.enabled ?? true,
    generate: (prompt) => {
      prompts.push(prompt)
      return (
        options?.generate?.(prompt) ?? Promise.resolve({ ok: true, text: 'Consejo de prueba.' })
      )
    },
    onTip: (tip) => tips.push(tip),
    intervalS: 60
  })
  return { coach, tips, prompts }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('LiveCoach', () => {
  it('emits one tip per interval, not per snapshot', async () => {
    const { coach, tips, prompts } = makeCoach()
    coach.onGameState(stateAt(600), [], null)
    coach.onGameState(stateAt(602), [], null) // 2s later: throttled
    coach.onGameState(stateAt(630), [], null) // 30s later: still throttled
    await flush()
    expect(prompts.length).toBe(1)
    expect(tips).toEqual([{ gameTimeS: 600, text: 'Consejo de prueba.' }])

    coach.onGameState(stateAt(661), [], null) // past the interval
    await flush()
    expect(prompts.length).toBe(2)
  })

  it('stays quiet before minute 3 and while disabled', async () => {
    const early = makeCoach()
    early.coach.onGameState(stateAt(120), [], null)
    await flush()
    expect(early.prompts.length).toBe(0)

    const disabled = makeCoach({ enabled: false })
    disabled.coach.onGameState(stateAt(600), [], null)
    await flush()
    expect(disabled.prompts.length).toBe(0)
  })

  it('facts carry recent events, objective timers and the next buy', () => {
    const { coach } = makeCoach()
    const state = stateAt(600)
    const enemyTeam = state.self.team === 'ORDER' ? 'CHAOS' : 'ORDER'
    const events: GameStateEvent[] = [
      { type: 'playerDied', championName: 'Zed', team: enemyTeam },
      { type: 'objectiveTaken', team: enemyTeam, objective: 'dragon', detail: 'Infernal' }
    ]
    coach.onGameState(stateAt(595), [], null) // arms lastSeen before events
    coach.onGameState(state, events, {
      itemId: 3031,
      itemName: 'Filo Infinito',
      category: null,
      action: 'prioritize',
      score: 90,
      reasons: []
    })
    const facts = coach.buildFacts(state, {
      itemId: 3031,
      itemName: 'Filo Infinito',
      category: null,
      action: 'prioritize',
      score: 90,
      reasons: []
    })
    expect(facts.eventosRecientes.some((event) => event.includes('Zed'))).toBe(true)
    expect(facts.eventosRecientes.some((event) => event.includes('dragón'))).toBe(true)
    // Dragon taken at 600 → respawns 300s later.
    expect(facts.dragonSaleEnS).toBe(300)
    expect(facts.baronSaleEnS).toBeNull() // pre-20min
    expect(facts.proximaCompra).toContain('Filo Infinito')
    expect(facts.oroEquipoAliado).toBeGreaterThan(0)
  })

  it('goes quiet after three consecutive generation failures', async () => {
    const { coach, prompts, tips } = makeCoach({
      generate: () => Promise.resolve({ ok: false, error: 'down' })
    })
    for (const t of [600, 661, 722, 783, 844]) {
      coach.onGameState(stateAt(t), [], null)
      await flush()
    }
    expect(prompts.length).toBe(3)
    expect(tips.length).toBe(0)
  })

  it('sanitizes model output (quotes, emoji, introductions and newlines)', async () => {
    const { coach, tips } = makeCoach({
      generate: () =>
        Promise.resolve({
          ok: true,
          text: '  "🔮 Soy Hexi, tu coach. Si puedes mantener prioridad, considera visión\nantes del dragón."  '
        })
    })
    coach.onGameState(stateAt(600), [], null)
    await flush()
    expect(tips[0]?.text).toBe('Si puedes mantener prioridad, considera visión antes del dragón.')
  })
})

describe('direction track (strategic read)', () => {
  it('fires on its own slower cadence with role guidance and all visible players', async () => {
    const prompts: string[] = []
    const directions: LiveCoachTip[] = []
    const coach = new LiveCoach({
      isEnabled: () => true,
      generate: (prompt) => {
        prompts.push(prompt)
        return Promise.resolve({ ok: true, text: 'Plan de prueba.' })
      },
      onTip: () => undefined,
      onDirection: (tip) => directions.push(tip),
      intervalS: 10_000, // effectively disable the fast track
      directionIntervalS: 150
    })
    coach.onGameState(stateAt(600), [], null)
    await flush()
    coach.onGameState(stateAt(700), [], null) // < 150s later: throttled
    await flush()
    coach.onGameState(stateAt(760), [], null) // past the interval
    await flush()

    const directionPrompts = prompts.filter((prompt) => prompt.includes('"jugadores"'))
    expect(directionPrompts.length).toBe(2)
    expect(directions.length).toBe(2)
    // Role guidance for the fixture's own position and the full scoreboard.
    const prompt = directionPrompts[0] ?? ''
    expect(prompt).toContain('jugadores')
    expect(prompt).toContain('aliados')
    expect(prompt).toContain('enemigos')
    expect(prompt).toContain('PROHIBIDO inventar')
  })
})

describe('buildLiveCoachPrompt', () => {
  it('embeds the facts and the constraints', () => {
    const prompt = buildLiveCoachPrompt({
      minuto: 14.2,
      tuCampeon: 'Jinx',
      nivel: 11,
      kda: '4/1/6',
      cs: 130,
      oroActual: 1800,
      oroEquipoAliado: 30000,
      oroEquipoEnemigo: 27000,
      dragonSaleEnS: 40,
      baronSaleEnS: null,
      eventosRecientes: ['Zed (enemigo) ha muerto'],
      proximaCompra: 'Filo Infinito (puedes comprarlo YA)'
    })
    expect(prompt).toContain('Jinx')
    expect(prompt).toContain('dragonSaleEnS')
    expect(prompt).toContain('PROHIBIDO inventar')
    expect(prompt).toContain('26 palabras')
    expect(prompt).toContain('opciones condicionales')
  })
})
