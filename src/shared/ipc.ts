/**
 * Typed IPC contract between main and renderer.
 * Every channel is declared here; nothing else may call ipcRenderer/ipcMain
 * with raw strings.
 *
 * - `IpcInvokeChannels`: request/response (renderer -> main, awaited).
 * - `IpcEventChannels`: push events (main -> renderer).
 */
import type { LiveClientSnapshot } from './schemas/liveclient'
import type { ChampSelectState } from './schemas/lcu'
import type { ChampionMeta, ChampSelectInsights } from './champselect'
import type { GameScenario } from './scenario'
import type { GameState, GameStateEvent } from './gamestate'
import type { HistoryAggregate, HistoryDetail, HistoryRow } from './history'
import type { PersonalCurve, StatsOverview } from './stats'
import type { PostGameReport, PostGameReportResult } from './report'
import type { Recommendation } from './recommendation'
import type { SessionPhase } from './session'
import type { Locale } from './i18n/types'

export interface RecommendationsPayload {
  gameTimeS: number
  recommendations: Recommendation[]
}

export interface AppSettings {
  riotId: string | null
  platform: string
  /** Dev tool: dump raw live snapshots to fixtures/recordings. */
  recordLive: boolean
  /** UI sounds (recommendation chime, spike alerts). */
  soundsEnabled: boolean
  /** Master volume 0-100 (60 = original level). */
  soundVolume: number
  /** Per-category sound toggles. */
  soundCategories: { recommendation: boolean; spike: boolean; objective: boolean }
  /** Experimental in-game overlay window (shows while inGame). */
  overlayEnabled: boolean
  /** Identity id ('neon'); legacy ids normalize onto it. */
  theme: string
  /** UI language ('en' | 'es'); ADR-009. */
  locale: Locale
  /** Whether a Riot API key is configured (env or stored). The key itself never crosses IPC. */
  apiKeySet: boolean
}

export interface MetaCrawlProgress {
  running: boolean
  processed: number
  stored: number
  seedsDone: number
  seedsTotal: number
  /** Matches aggregated per hour this run (0 until enough has elapsed). */
  gamesPerHour: number
  error: string | null
}

export interface MetaStatusPayload extends MetaCrawlProgress {
  /** Aggregated matches per patch, newest patch first. */
  patches: { patch: string; matches: number }[]
  /** The shared Master+ base this install imported (WP-019), if any. */
  seed: { patch: string; exportedAt: string } | null
  /** Current live patch (2-segment), for the current-patch total. */
  livePatch: string | null
}

export interface IngestProgressPayload {
  fetched: number
  stored: number
  skipped: number
  failed: number
  done: boolean
  currentMatchId?: string
  error?: string
}

export interface IpcInvokeChannels {
  'app:ping': { args: []; result: { pong: true; version: string } }
  'settings:get': { args: []; result: AppSettings }
  'settings:set': {
    args: [
      {
        riotId: string
        platform: string
        recordLive: boolean
        soundsEnabled: boolean
        soundVolume: number
        soundCategories: { recommendation: boolean; spike: boolean; objective: boolean }
        overlayEnabled: boolean
        theme: string
        locale: Locale
        /** New Riot API key to store; undefined = keep current, '' = clear. */
        apiKey?: string
      }
    ]
    result: { saved: true }
  }
  'ingest:start': { args: []; result: { started: boolean; error?: string } }
  /** Overlay hover: true = accept mouse input, false = click-through to the game. */
  'overlay:interactive': { args: [interactive: boolean]; result: { ok: true } }
  /** Local-AI coach (Ollama): availability + configuration. */
  'coach:status': {
    args: []
    result: {
      enabled: boolean
      model: string
      available: boolean
      models: string[]
      /** In-game macro tips (Hexi in the overlay, ~1/min). */
      liveEnabled: boolean
    }
  }
  'coach:configure': {
    args: [config: { enabled: boolean; model: string; liveEnabled: boolean }]
    result: { saved: true }
  }
  /** Spanish coaching prose for a post-game report (facts passed in, localhost-only). */
  'coach:analyze': {
    args: [report: PostGameReport]
    result: { ok: boolean; text?: string; error?: string }
  }
  /** Spanish draft advice from the current champ-select insights. */
  'coach:draft': {
    args: [insights: ChampSelectInsights]
    result: { ok: boolean; text?: string; error?: string }
  }
  'session:get': { args: []; result: SessionPhase }
  /** Champion meta (ddragon id, name, damage type) keyed by numeric champion key. */
  'staticdata:championMeta': { args: []; result: Record<number, ChampionMeta> }
  /** Comp analysis + owner plan for the current champ select (null before static data loads). */
  'champselect:insights': { args: [state: ChampSelectState]; result: ChampSelectInsights | null }
  'history:list': { args: [filter?: { champion?: string }]; result: HistoryRow[] }
  'history:aggregates': { args: []; result: HistoryAggregate[] }
  'history:champions': { args: []; result: string[] }
  'history:detail': { args: [matchId: string]; result: HistoryDetail | null }
  /** Personal statistics over the stored history (null until puuid resolved). */
  'stats:overview': { args: []; result: StatsOverview | null }
  /** Personal CS/gold laning baseline for one champion (null if <2 games). */
  'stats:curve': { args: [champion: string]; result: PersonalCurve | null }
  /** Report for the most recent live session linked to a stored match. */
  'report:last': { args: []; result: PostGameReportResult | null }
  /** Report for any stored match (Historial → Ver informe). */
  'report:forMatch': { args: [matchId: string]; result: PostGameReportResult | null }
  /** Dev-only simulation tools (empty/refused in the packaged app). */
  'dev:replays': { args: []; result: { id: string; label: string; snapshots: number }[] }
  'dev:replay:start': {
    args: [id: string, intervalMs?: number]
    result: { started: boolean; error?: string }
  }
  'dev:replay:stop': { args: []; result: { stopped: true } }
  'dev:replay:status': {
    args: []
    result: { running: boolean; id: string | null; progressPct: number }
  }
  'dev:champselect:start': { args: []; result: { started: boolean } }
  /** Custom draft built in the scenario UI (dev only). */
  'dev:champselect:custom': { args: [state: ChampSelectState]; result: { started: boolean } }
  'dev:champselect:stop': { args: []; result: { stopped: true } }
  /** Forced in-game situations (synthetic snapshots through the real pipeline). */
  'dev:scenario:start': {
    args: [scenario: GameScenario]
    result: { started: boolean; error?: string }
  }
  'dev:scenario:update': {
    args: [scenario: GameScenario]
    result: { updated: boolean; error?: string }
  }
  'dev:scenario:stop': { args: []; result: { stopped: true } }
  /** True in dev builds — gates the whole simulation panel. */
  'dev:enabled': { args: []; result: boolean }
  /** Purchasable SR items for the scenario item pickers. */
  'staticdata:itemCatalog': {
    args: []
    result: { id: number; name: string; totalGold: number }[]
  }
  /** Master+ meta aggregation (crawler status/control). */
  'meta:status': { args: []; result: MetaStatusPayload }
  'meta:crawl:start': { args: []; result: { started: boolean; error?: string } }
  'meta:crawl:stop': { args: []; result: { stopped: true } }
}

export interface IpcEventChannels {
  'live:snapshot': LiveClientSnapshot
  'live:state': 'unavailable' | 'loading' | 'polling'
  'ingest:progress': IngestProgressPayload
  'session:phase': SessionPhase
  'session:champselect': ChampSelectState | null
  'gamestate:update': GameState
  'gamestate:events': GameStateEvent[]
  'gamestate:recommendations': RecommendationsPayload
  /** A finished match landed in the DB (post-game auto-ingest). */
  'history:changed': { matchId: string }
  /** Meta crawler progress ticks. */
  'meta:progress': MetaCrawlProgress
  /** Live macro tip from the local-AI coach (the mascot speaks it in the overlay). */
  'coach:tip': { gameTimeS: number; text: string }
  /** Role-aware strategic read of the game (Live panel, slower cadence). */
  'coach:direction': { gameTimeS: number; text: string }
}

export type IpcInvokeChannel = keyof IpcInvokeChannels
export type IpcEventChannel = keyof IpcEventChannels

export const IPC_INVOKE_CHANNELS: readonly IpcInvokeChannel[] = [
  'app:ping',
  'settings:get',
  'settings:set',
  'ingest:start',
  'session:get',
  'staticdata:championMeta',
  'champselect:insights',
  'history:list',
  'history:aggregates',
  'history:champions',
  'history:detail',
  'stats:overview',
  'stats:curve',
  'report:last',
  'report:forMatch',
  'dev:replays',
  'dev:replay:start',
  'dev:replay:stop',
  'dev:replay:status',
  'dev:champselect:start',
  'dev:champselect:custom',
  'dev:champselect:stop',
  'dev:scenario:start',
  'dev:scenario:update',
  'dev:scenario:stop',
  'dev:enabled',
  'staticdata:itemCatalog',
  'meta:status',
  'meta:crawl:start',
  'meta:crawl:stop',
  'overlay:interactive',
  'coach:status',
  'coach:configure',
  'coach:analyze',
  'coach:draft'
]

export const IPC_EVENT_CHANNELS: readonly IpcEventChannel[] = [
  'live:snapshot',
  'live:state',
  'ingest:progress',
  'session:phase',
  'session:champselect',
  'gamestate:update',
  'gamestate:events',
  'gamestate:recommendations',
  'history:changed',
  'meta:progress',
  'coach:tip',
  'coach:direction'
]

/** Shape of the API the preload script exposes on window.api */
export interface RendererApi {
  invoke<C extends IpcInvokeChannel>(
    channel: C,
    ...args: IpcInvokeChannels[C]['args']
  ): Promise<IpcInvokeChannels[C]['result']>
  /** Subscribe to a main-process push channel. Returns an unsubscribe fn. */
  on<C extends IpcEventChannel>(
    channel: C,
    listener: (payload: IpcEventChannels[C]) => void
  ): () => void
}
