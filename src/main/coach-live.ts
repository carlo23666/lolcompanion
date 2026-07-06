import type { GameState, GameStateEvent } from '@shared/gamestate'
import type { Recommendation } from '@shared/recommendation'

/**
 * Live macro coach: every ~60s of game time, the local model (Ollama) turns
 * the CURRENT screen-visible facts — gold, deaths, enemy spikes, objective
 * timers, next buy — into one short Spanish tip that Hexi delivers in the
 * overlay ("pon visión antes del dragón", "vais 2k arriba y su jungla está
 * muerto: forzad", "completa tu compra antes de la siguiente jugada").
 *
 * Strictly advisory prose over facts the player can already see (Riot policy
 * §4); the rules engine remains the only source of item recommendations.
 * Pure facts/prompt builders + a driver class with an injected generator so
 * everything tests without Ollama or electron.
 */

// Objective spawn timing — same game constants as the renderer insights hook
// (src/renderer/src/hooks.ts). ADJUST PER PATCH if Riot moves them.
const DRAGON_FIRST_SPAWN_S = 5 * 60
const DRAGON_RESPAWN_S = 5 * 60
const BARON_SPAWN_S = 20 * 60
const BARON_RESPAWN_S = 6 * 60

/** No tips during early laning: macro calls barely apply before first base. */
const MIN_GAME_TIME_S = 180
const DEFAULT_INTERVAL_S = 60
/** Recent-event window fed to the model. */
const RECENT_WINDOW_S = 45
const MAX_RECENT_EVENTS = 6
/** After this many consecutive Ollama failures the coach goes quiet. */
const MAX_FAILURES = 3

export interface LiveCoachTip {
  gameTimeS: number
  text: string
}

interface RecentEvent {
  atS: number
  text: string
}

export interface LiveFacts {
  minuto: number
  tuCampeon: string
  nivel: number
  kda: string
  cs: number
  oroActual: number
  oroEquipoAliado: number
  oroEquipoEnemigo: number
  /** Seconds until spawn; 0 = alive now; null = not applicable yet. */
  dragonSaleEnS: number | null
  baronSaleEnS: number | null
  eventosRecientes: string[]
  proximaCompra: string | null
}

export function buildLiveCoachPrompt(facts: LiveFacts): string {
  return [
    'Eres Hexi, el espíritu hextech que acompaña a un jugador de League of Legends EN PLENA PARTIDA.',
    'Con los DATOS (JSON) da UN único consejo de macro para ESTE momento.',
    'Tipos de consejo según lo que digan los datos: poner visión antes de que salga un objetivo;',
    'jugar agresivo si hay ventaja de oro o enemigos muertos; jugar seguro si vais por detrás o',
    'hay spikes enemigos recientes; preparar/empujar la oleada antes de volver a base; completar la próxima compra.',
    'PROHIBIDO inventar datos, campeones u objetos que no estén en el JSON.',
    '',
    `DATOS: ${JSON.stringify(facts)}`,
    '',
    'Responde en español, tuteo, UNA sola frase de máximo 22 palabras, sin markdown ni comillas.'
  ].join('\n')
}

const ACTION_LABEL: Record<Recommendation['action'], string> = {
  prioritize: 'puedes comprarlo YA',
  add: 'próxima compra',
  delay: 'ahorra para él',
  replace: 'vende y cámbialo'
}

export interface LiveCoachOptions {
  /** Consulted every tick — flips live when Ajustes change. */
  isEnabled(): boolean
  generate(prompt: string): Promise<{ ok: true; text: string } | { ok: false; error: string }>
  onTip(tip: LiveCoachTip): void
  intervalS?: number
  log?: (message: string) => void
}

export class LiveCoach {
  private readonly intervalS: number
  private lastTipAtS = Number.NEGATIVE_INFINITY
  private lastSeenS = 0
  private nextDragonS = DRAGON_FIRST_SPAWN_S
  private nextBaronS = BARON_SPAWN_S
  private recent: RecentEvent[] = []
  private inFlight = false
  private failures = 0

  constructor(private readonly options: LiveCoachOptions) {
    this.intervalS = options.intervalS ?? DEFAULT_INTERVAL_S
  }

  reset(): void {
    this.lastTipAtS = Number.NEGATIVE_INFINITY
    this.lastSeenS = 0
    this.nextDragonS = DRAGON_FIRST_SPAWN_S
    this.nextBaronS = BARON_SPAWN_S
    this.recent = []
    this.failures = 0
  }

  onGameState(
    state: GameState,
    events: GameStateEvent[],
    topRecommendation: Recommendation | null
  ): void {
    if (state.gameTimeS < this.lastSeenS - 5) this.reset() // game time went backwards → new game
    this.lastSeenS = state.gameTimeS
    this.trackEvents(state, events)
    this.maybeTick(state, topRecommendation)
  }

  buildFacts(state: GameState, topRecommendation: Recommendation | null): LiveFacts {
    const now = state.gameTimeS
    const fresh = this.recent.filter((event) => now - event.atS <= RECENT_WINDOW_S)
    return {
      minuto: Math.round((now / 60) * 10) / 10,
      tuCampeon: state.self.championName,
      nivel: state.self.level,
      kda: `${String(state.self.scores.kills)}/${String(state.self.scores.deaths)}/${String(state.self.scores.assists)}`,
      cs: state.self.scores.creepScore,
      oroActual: Math.round(state.self.currentGold),
      oroEquipoAliado: Math.round(state.allyAggregates.estimatedTotalGold),
      oroEquipoEnemigo: Math.round(state.enemyAggregates.estimatedTotalGold),
      dragonSaleEnS: Math.max(0, Math.round(this.nextDragonS - now)),
      baronSaleEnS: now >= BARON_SPAWN_S - 120 ? Math.max(0, Math.round(this.nextBaronS - now)) : null,
      eventosRecientes: fresh.slice(-MAX_RECENT_EVENTS).map((event) => event.text),
      proximaCompra:
        topRecommendation === null
          ? null
          : `${topRecommendation.itemName ?? topRecommendation.category ?? ''} (${ACTION_LABEL[topRecommendation.action]})`
    }
  }

  private trackEvents(state: GameState, events: GameStateEvent[]): void {
    const now = state.gameTimeS
    const selfTeam = state.self.team
    for (const event of events) {
      const enemy = event.type !== 'objectiveTaken' && event.team !== selfTeam
      if (event.type === 'playerDied') {
        this.recent.push({
          atS: now,
          text: `${event.championName} (${enemy ? 'enemigo' : 'aliado'}) ha muerto`
        })
      } else if (event.type === 'itemCompleted' && enemy && event.item.totalGold >= 2400) {
        this.recent.push({
          atS: now,
          text: `spike: ${event.championName} (enemigo) ha completado ${event.item.name}`
        })
      } else if (event.type === 'objectiveTaken') {
        const ours = event.team === selfTeam
        if (event.objective === 'dragon') this.nextDragonS = now + DRAGON_RESPAWN_S
        if (event.objective === 'baron') this.nextBaronS = now + BARON_RESPAWN_S
        if (event.objective === 'dragon' || event.objective === 'baron') {
          this.recent.push({
            atS: now,
            text: `${event.objective === 'dragon' ? 'dragón' : 'Barón'} para ${ours ? 'vuestro equipo' : 'el enemigo'}`
          })
        }
      }
    }
    // Keep the buffer bounded.
    if (this.recent.length > 24) this.recent = this.recent.slice(-24)
  }

  private maybeTick(state: GameState, topRecommendation: Recommendation | null): void {
    if (!this.options.isEnabled() || this.inFlight || this.failures >= MAX_FAILURES) return
    if (state.gameTimeS < MIN_GAME_TIME_S) return
    if (state.gameTimeS - this.lastTipAtS < this.intervalS) return
    this.inFlight = true
    this.lastTipAtS = state.gameTimeS
    const prompt = buildLiveCoachPrompt(this.buildFacts(state, topRecommendation))
    const atS = state.gameTimeS
    void this.options.generate(prompt).then((result) => {
      this.inFlight = false
      if (result.ok) {
        this.failures = 0
        // One clean line: models sometimes wrap in quotes or add newlines.
        const text = result.text.replace(/\s+/g, ' ').trim().replace(/^["'«]+|["'»]+$/g, '')
        if (text !== '') this.options.onTip({ gameTimeS: atS, text: text.slice(0, 220) })
      } else {
        this.failures += 1
        this.options.log?.(
          `[coach-live] tip failed (${String(this.failures)}/${String(MAX_FAILURES)}): ${result.error}`
        )
      }
    })
  }
}
