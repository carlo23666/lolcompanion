import { sanitizeChampSelect } from '@shared/schemas/lcu'
import { broadcast } from '../ipc'
import { SessionMachine } from '../session/machine'
import { LcuConnector } from './connector'

export { LcuConnector } from './connector'
export type { LcuConnectorEvents } from './connector'

/**
 * Wires the LCU connector into the session machine and IPC.
 * Champ select payloads are sanitized (identities stripped) BEFORE they leave
 * the main process — policy hard rule.
 */
export function startLcu(machine: SessionMachine): LcuConnector {
  const connector = new LcuConnector({
    onConnected: () => machine.setLcuConnected(true),
    onDisconnected: () => {
      machine.setLcuConnected(false)
      broadcast('session:champselect', null)
    },
    onGameflowPhase: (phase) => machine.setLcuPhase(phase),
    onChampSelect: (raw) => broadcast('session:champselect', sanitizeChampSelect(raw))
  })
  connector.start()
  return connector
}
