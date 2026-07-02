import { useEffect, useState } from 'react'
import type { IpcEventChannel, IpcEventChannels } from '@shared/ipc'

/** Subscribes to a push channel and keeps the latest payload as state. */
export function useIpcEvent<C extends IpcEventChannel>(
  channel: C,
  initial: IpcEventChannels[C] | null = null
): IpcEventChannels[C] | null {
  const [value, setValue] = useState<IpcEventChannels[C] | null>(initial)
  useEffect(() => window.api.on(channel, setValue), [channel])
  return value
}
