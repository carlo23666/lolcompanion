import { ipcMain } from 'electron'
import type { IpcInvokeChannel, IpcInvokeChannels } from '@shared/ipc'

/**
 * Typed wrapper over ipcMain.handle. All invoke handlers must be registered
 * through this function so channel names and payloads stay in sync with
 * `src/shared/ipc.ts`.
 */
export function handleInvoke<C extends IpcInvokeChannel>(
  channel: C,
  handler: (
    ...args: IpcInvokeChannels[C]['args']
  ) => IpcInvokeChannels[C]['result'] | Promise<IpcInvokeChannels[C]['result']>
): void {
  ipcMain.handle(channel, (_event, ...args) =>
    handler(...(args as IpcInvokeChannels[C]['args']))
  )
}
