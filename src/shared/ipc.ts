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
import type { GameState, GameStateEvent } from './gamestate'
import type { HistoryAggregate, HistoryDetail, HistoryRow } from './history'
import type { PersonalCurve, StatsOverview } from './stats'
import type { Recommendation } from './recommendation'
import type { SessionPhase } from './session'

export interface RecommendationsPayload {
  gameTimeS: number
  recommendations: Recommendation[]
}

export interface AppSettings {
  riotId: string | null
  platform: string
  /** Dev tool: dump raw live snapshots to fixtures/recordings. */
  recordLive: boolean
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
    args: [{ riotId: string; platform: string; recordLive: boolean }]
    result: { saved: true }
  }
  'ingest:start': { args: []; result: { started: boolean; error?: string } }
  'session:get': { args: []; result: SessionPhase }
  /** Champion display names keyed by numeric champion key (LCU champ select uses keys). */
  'staticdata:championNames': { args: []; result: Record<number, string> }
  'history:list': { args: [filter?: { champion?: string }]; result: HistoryRow[] }
  'history:aggregates': { args: []; result: HistoryAggregate[] }
  'history:champions': { args: []; result: string[] }
  'history:detail': { args: [matchId: string]; result: HistoryDetail | null }
  /** Personal statistics over the stored history (null until puuid resolved). */
  'stats:overview': { args: []; result: StatsOverview | null }
  /** Personal CS/gold laning baseline for one champion (null if <2 games). */
  'stats:curve': { args: [champion: string]; result: PersonalCurve | null }
}

export interface IpcEventChannels {
  'live:snapshot': LiveClientSnapshot
  'live:state': 'unavailable' | 'polling'
  'ingest:progress': IngestProgressPayload
  'session:phase': SessionPhase
  'session:champselect': ChampSelectState | null
  'gamestate:update': GameState
  'gamestate:events': GameStateEvent[]
  'gamestate:recommendations': RecommendationsPayload
  /** A finished match landed in the DB (post-game auto-ingest). */
  'history:changed': { matchId: string }
}

export type IpcInvokeChannel = keyof IpcInvokeChannels
export type IpcEventChannel = keyof IpcEventChannels

export const IPC_INVOKE_CHANNELS: readonly IpcInvokeChannel[] = [
  'app:ping',
  'settings:get',
  'settings:set',
  'ingest:start',
  'session:get',
  'staticdata:championNames',
  'history:list',
  'history:aggregates',
  'history:champions',
  'history:detail',
  'stats:overview',
  'stats:curve'
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
  'history:changed'
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
