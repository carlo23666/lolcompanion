/**
 * Typed IPC contract between main and renderer.
 * Every channel is declared here; nothing else may call ipcRenderer/ipcMain
 * with raw strings.
 *
 * - `IpcInvokeChannels`: request/response (renderer -> main, awaited).
 * - `IpcEventChannels`: push events (main -> renderer).
 */

export interface IpcInvokeChannels {
  'app:ping': { args: []; result: { pong: true; version: string } }
}

export interface IpcEventChannels {
  // Populated by later WPs (live:snapshot, session:phase, ingest:progress, ...)
  [key: string]: never
}

export type IpcInvokeChannel = keyof IpcInvokeChannels

/** Shape of the API the preload script exposes on window.api */
export interface RendererApi {
  invoke<C extends IpcInvokeChannel>(
    channel: C,
    ...args: IpcInvokeChannels[C]['args']
  ): Promise<IpcInvokeChannels[C]['result']>
}
