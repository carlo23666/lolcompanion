import type { GameState, GameStateEvent } from '@shared/gamestate'
import type { Recommendation } from '@shared/recommendation'
import { t as translators, type MessageKey, type Translator } from '@shared/i18n'
import { buildPersona, sanitizeCoachText } from './coach'

/**
 * Live macro coach: every ~60s of game time, the local model (Ollama) turns
 * the CURRENT screen-visible facts — gold, deaths, enemy spikes, objective
 * timers, next buy — into one short conditional read shown above the stable
 * bottom overlay dock.
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
/** The strategic read refreshes slower — it's a plan, not a ping. */
const DEFAULT_DIRECTION_INTERVAL_S = 150
/** Recent-event window fed to the model. */
const RECENT_WINDOW_S = 45
const MAX_RECENT_EVENTS = 6
/** After this many consecutive Ollama failures the coach goes quiet. */
const MAX_FAILURES = 3

export interface LiveCoachTip {
  gameTimeS: number
  text: string
}

/** One visible player line for the strategic read (scoreboard data only). */
interface PlayerFact {
  campeon: string
  posicion: string
  nivel: number
  kda: string
  cs: number
}

function playerFact(player: {
  championName: string
  position: string
  level: number
  scores: { kills: number; deaths: number; assists: number; creepScore: number }
}): PlayerFact {
  return {
    campeon: player.championName,
    posicion: player.position,
    nivel: player.level,
    kda: `${String(player.scores.kills)}/${String(player.scores.deaths)}/${String(player.scores.assists)}`,
    cs: player.scores.creepScore
  }
}

const ROLE_GUIDANCE_KEYS: Record<string, MessageKey> = {
  JUNGLE: 'coach.role.jungle',
  BOTTOM: 'coach.role.bottom',
  UTILITY: 'coach.role.utility',
  MIDDLE: 'coach.role.middle',
  TOP: 'coach.role.top'
}

/** Full strategic read: game state + every visible player + role guidance. */
export function buildDirectionPrompt(
  facts: LiveFacts,
  players: { aliados: PlayerFact[]; enemigos: PlayerFact[] },
  ownPosition: string,
  personaName = 'Hexi',
  t: Translator = translators.es
): string {
  return [
    buildPersona(personaName, t),
    t('coach.dir.frame'),
    t(ROLE_GUIDANCE_KEYS[ownPosition] ?? 'coach.role.default'),
    t('coach.dir.noInvent'),
    '',
    `${t('coach.dataLabel')}: ${JSON.stringify({ ...facts, jugadores: players })}`,
    '',
    t('coach.dir.output')
  ].join('\n')
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

export function buildLiveCoachPrompt(
  facts: LiveFacts,
  personaName = 'Hexi',
  t: Translator = translators.es
): string {
  return [
    buildPersona(personaName, t),
    t('coach.live.frame'),
    t('coach.dir.noInvent'),
    '',
    `${t('coach.dataLabel')}: ${JSON.stringify(facts)}`,
    '',
    t('coach.live.output')
  ].join('\n')
}

const ACTION_LABEL_KEYS: Record<Recommendation['action'], MessageKey> = {
  prioritize: 'coach.act.prioritize',
  add: 'coach.act.add',
  delay: 'coach.act.delay',
  replace: 'coach.act.replace'
}

export interface LiveCoachOptions {
  /** Consulted every tick — flips live when Ajustes change. */
  isEnabled(): boolean
  generate(prompt: string): Promise<{ ok: true; text: string } | { ok: false; error: string }>
  onTip(tip: LiveCoachTip): void
  /** Strategic read (2-4 sentences, role-aware) on a slower cadence. */
  onDirection?(tip: LiveCoachTip): void
  /** Mascot/persona name for the prompt (follows the active theme). */
  personaName?: () => string
  /** Translator for prompt text + fact strings (ADR-009); defaults to Spanish. */
  translate?: () => Translator
  intervalS?: number
  directionIntervalS?: number
  log?: (message: string) => void
}

export class LiveCoach {
  private readonly intervalS: number
  private readonly directionIntervalS: number
  private lastTipAtS = Number.NEGATIVE_INFINITY
  private lastDirectionAtS = Number.NEGATIVE_INFINITY
  private lastSeenS = 0
  private nextDragonS = DRAGON_FIRST_SPAWN_S
  private nextBaronS = BARON_SPAWN_S
  private recent: RecentEvent[] = []
  private inFlight = false
  private directionInFlight = false
  private failures = 0

  constructor(private readonly options: LiveCoachOptions) {
    this.intervalS = options.intervalS ?? DEFAULT_INTERVAL_S
    this.directionIntervalS = options.directionIntervalS ?? DEFAULT_DIRECTION_INTERVAL_S
  }

  private get t(): Translator {
    return this.options.translate?.() ?? translators.es
  }

  reset(): void {
    this.lastTipAtS = Number.NEGATIVE_INFINITY
    this.lastDirectionAtS = Number.NEGATIVE_INFINITY
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
    this.maybeDirection(state, topRecommendation)
  }

  private maybeDirection(state: GameState, topRecommendation: Recommendation | null): void {
    if (this.options.onDirection === undefined) return
    if (!this.options.isEnabled() || this.directionInFlight || this.failures >= MAX_FAILURES) return
    if (state.gameTimeS < MIN_GAME_TIME_S) return
    if (state.gameTimeS - this.lastDirectionAtS < this.directionIntervalS) return
    this.directionInFlight = true
    this.lastDirectionAtS = state.gameTimeS
    const prompt = buildDirectionPrompt(
      this.buildFacts(state, topRecommendation),
      {
        aliados: [state.self, ...state.allies].map(playerFact),
        enemigos: state.enemies.map(playerFact)
      },
      state.self.position,
      this.options.personaName?.() ?? 'Hexi',
      this.t
    )
    const atS = state.gameTimeS
    void this.options.generate(prompt).then((result) => {
      this.directionInFlight = false
      if (result.ok) {
        const text = sanitizeCoachText(result.text)
        if (text !== '') this.options.onDirection?.({ gameTimeS: atS, text: text.slice(0, 600) })
      } else {
        this.failures += 1
        this.options.log?.(`[coach-live] direction failed: ${result.error}`)
      }
    })
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
      baronSaleEnS:
        now >= BARON_SPAWN_S - 120 ? Math.max(0, Math.round(this.nextBaronS - now)) : null,
      eventosRecientes: fresh.slice(-MAX_RECENT_EVENTS).map((event) => event.text),
      proximaCompra:
        topRecommendation === null
          ? null
          : `${topRecommendation.itemName ?? topRecommendation.category ?? ''} (${this.t(ACTION_LABEL_KEYS[topRecommendation.action])})`
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
          text: this.t('coach.ev.died', {
            champion: event.championName,
            side: enemy ? this.t('coach.side.enemy') : this.t('coach.side.ally')
          })
        })
      } else if (event.type === 'itemCompleted' && enemy && event.item.totalGold >= 2400) {
        this.recent.push({
          atS: now,
          text: this.t('coach.ev.spike', {
            champion: event.championName,
            item: event.item.name
          })
        })
      } else if (event.type === 'objectiveTaken') {
        const ours = event.team === selfTeam
        if (event.objective === 'dragon') this.nextDragonS = now + DRAGON_RESPAWN_S
        if (event.objective === 'baron') this.nextBaronS = now + BARON_RESPAWN_S
        if (event.objective === 'dragon' || event.objective === 'baron') {
          this.recent.push({
            atS: now,
            text: this.t('coach.ev.objective', {
              objective: this.t(event.objective === 'dragon' ? 'overlay.dragon' : 'overlay.baron'),
              side: ours ? this.t('coach.side.yourTeam') : this.t('coach.side.enemyTeam')
            })
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
    const prompt = buildLiveCoachPrompt(
      this.buildFacts(state, topRecommendation),
      this.options.personaName?.() ?? 'Hexi',
      this.t
    )
    const atS = state.gameTimeS
    void this.options.generate(prompt).then((result) => {
      this.inFlight = false
      if (result.ok) {
        this.failures = 0
        const text = sanitizeCoachText(result.text)
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
