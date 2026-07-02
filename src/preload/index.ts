import { contextBridge, ipcRenderer } from 'electron'
import type { IpcInvokeChannel, RendererApi } from '@shared/ipc'

/**
 * Channel allowlist: the preload refuses to forward anything not declared in
 * the typed IPC contract, so a compromised renderer cannot invoke arbitrary
 * main-process handlers.
 */
const invokeChannels: readonly IpcInvokeChannel[] = ['app:ping']

const api: RendererApi = {
  invoke(channel, ...args) {
    if (!invokeChannels.includes(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${String(channel)}`))
    }
    return ipcRenderer.invoke(channel, ...args) as ReturnType<RendererApi['invoke']>
  }
}

contextBridge.exposeInMainWorld('api', api)
