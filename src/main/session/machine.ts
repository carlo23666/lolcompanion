import type { SessionPhase } from '@shared/session'

/**
 * LCU gameflow phase → coarse intent. The Live Client port (:2999) is the
 * source of truth for `inGame`; LCU phases only distinguish the rest.
 */
export type LcuPhaseGroup = 'champSelect' | 'postGame' | 'inGameIntent' | 'other'

export function groupLcuPhase(lcuPhase: string): LcuPhaseGroup {
  switch (lcuPhase) {
    case 'ChampSelect':
      return 'champSelect'
    case 'WaitingForStats':
    case 'PreEndOfGame':
    case 'EndOfGame':
      return 'postGame'
    case 'GameStart':
    case 'InProgress':
    case 'Reconnect':
      return 'inGameIntent'
    default:
      // None, Lobby, Matchmaking, ReadyCheck, CheckedIntoTournament,
      // TerminatedInError, ...
      return 'other'
  }
}

export interface SessionInputs {
  lcuConnected: boolean
  lcuPhase: string | null
  liveState: 'unavailable' | 'polling'
}

/**
 * Pure phase computation:
 * - :2999 answering → inGame, whatever LCU thinks (source of truth).
 * - no LCU and no game → idle (app works with LoL closed).
 * - loading screen (LCU says InProgress but :2999 not up yet) → clientOpen.
 */
export function computeSessionPhase(inputs: SessionInputs): SessionPhase {
  if (inputs.liveState === 'polling') return 'inGame'
  if (!inputs.lcuConnected) return 'idle'
  switch (groupLcuPhase(inputs.lcuPhase ?? '')) {
    case 'champSelect':
      return 'champSelect'
    case 'postGame':
      return 'postGame'
    default:
      return 'clientOpen'
  }
}

/** Stateful wrapper emitting only on change. */
export class SessionMachine {
  private inputs: SessionInputs = {
    lcuConnected: false,
    lcuPhase: null,
    liveState: 'unavailable'
  }
  private phase: SessionPhase = 'idle'

  constructor(private readonly onPhaseChange: (phase: SessionPhase) => void) {}

  getPhase(): SessionPhase {
    return this.phase
  }

  setLcuConnected(connected: boolean): void {
    this.update({ lcuConnected: connected, lcuPhase: connected ? this.inputs.lcuPhase : null })
  }

  setLcuPhase(lcuPhase: string): void {
    this.update({ lcuPhase })
  }

  setLiveState(liveState: 'unavailable' | 'polling'): void {
    this.update({ liveState })
  }

  private update(partial: Partial<SessionInputs>): void {
    this.inputs = { ...this.inputs, ...partial }
    const next = computeSessionPhase(this.inputs)
    if (next !== this.phase) {
      this.phase = next
      this.onPhaseChange(next)
    }
  }
}
