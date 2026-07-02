/**
 * Typed IPC contract between main and renderer.
 * Every channel is declared here; nothing else may call ipcRenderer/ipcMain
 * with raw strings.
 *
 * - `IpcInvokeChannels`: request/response (renderer -> main, awaited).
 * - `IpcEventChannels`: push events (main -> renderer).
 */
import type { LiveClientSnapshot } from './schemas/liveclient'

export interface IpcInvokeChannels {
  'app:ping': { args: []; result: { pong: true; version: string } }
}

export interface IpcEventChannels {
  'live:snapshot': LiveClientSnapshot
  'live:state': 'unavailable' | 'polling'
}

export type IpcInvokeChannel = keyof IpcInvokeChannels
export type IpcEventChannel = keyof IpcEventChannels

export const IPC_EVENT_CHANNELS: readonly IpcEventChannel[] = ['live:snapshot', 'live:state']

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
