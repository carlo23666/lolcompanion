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
import type { SessionPhase } from './session'

export interface AppSettings {
  riotId: string | null
  platform: string
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
    args: [{ riotId: string; platform: string }]
    result: { saved: true }
  }
  'ingest:start': { args: []; result: { started: boolean; error?: string } }
  'session:get': { args: []; result: SessionPhase }
}

export interface IpcEventChannels {
  'live:snapshot': LiveClientSnapshot
  'live:state': 'unavailable' | 'polling'
  'ingest:progress': IngestProgressPayload
  'session:phase': SessionPhase
  'session:champselect': ChampSelectState | null
}

export type IpcInvokeChannel = keyof IpcInvokeChannels
export type IpcEventChannel = keyof IpcEventChannels

export const IPC_INVOKE_CHANNELS: readonly IpcInvokeChannel[] = [
  'app:ping',
  'settings:get',
  'settings:set',
  'ingest:start',
  'session:get'
]

export const IPC_EVENT_CHANNELS: readonly IpcEventChannel[] = [
  'live:snapshot',
  'live:state',
  'ingest:progress',
  'session:phase',
  'session:champselect'
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
