import { contextBridge, ipcRenderer } from 'electron'
import { IPC_EVENT_CHANNELS, IPC_INVOKE_CHANNELS, type RendererApi } from '@shared/ipc'

/**
 * Channel allowlist: the preload refuses to forward anything not declared in
 * the typed IPC contract, so a compromised renderer cannot invoke arbitrary
 * main-process handlers.
 */
const api: RendererApi = {
  invoke(channel, ...args) {
    if (!IPC_INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${String(channel)}`))
    }
    return ipcRenderer.invoke(channel, ...args) as ReturnType<RendererApi['invoke']>
  },
  on(channel, listener) {
    if (!IPC_EVENT_CHANNELS.includes(channel)) {
      throw new Error(`IPC event channel not allowed: ${String(channel)}`)
    }
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
      listener(payload as Parameters<typeof listener>[0])
    }
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  }
}

contextBridge.exposeInMainWorld('api', api)
