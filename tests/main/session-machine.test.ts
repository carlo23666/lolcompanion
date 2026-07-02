import { describe, expect, it } from 'vitest'
import { computeSessionPhase, groupLcuPhase, SessionMachine } from '@main/session/machine'
import type { SessionPhase } from '@shared/session'

describe('computeSessionPhase', () => {
  const cases: {
    name: string
    lcuConnected: boolean
    lcuPhase: string | null
    liveState: 'unavailable' | 'polling'
    expected: SessionPhase
  }[] = [
    { name: 'everything off', lcuConnected: false, lcuPhase: null, liveState: 'unavailable', expected: 'idle' },
    { name: 'client open, no lobby', lcuConnected: true, lcuPhase: 'None', liveState: 'unavailable', expected: 'clientOpen' },
    { name: 'lobby', lcuConnected: true, lcuPhase: 'Lobby', liveState: 'unavailable', expected: 'clientOpen' },
    { name: 'matchmaking', lcuConnected: true, lcuPhase: 'Matchmaking', liveState: 'unavailable', expected: 'clientOpen' },
    { name: 'ready check', lcuConnected: true, lcuPhase: 'ReadyCheck', liveState: 'unavailable', expected: 'clientOpen' },
    { name: 'champ select', lcuConnected: true, lcuPhase: 'ChampSelect', liveState: 'unavailable', expected: 'champSelect' },
    { name: 'loading screen (InProgress, port not up)', lcuConnected: true, lcuPhase: 'InProgress', liveState: 'unavailable', expected: 'clientOpen' },
    { name: 'in game (port up is source of truth)', lcuConnected: true, lcuPhase: 'InProgress', liveState: 'polling', expected: 'inGame' },
    { name: 'in game even if LCU is confused', lcuConnected: true, lcuPhase: 'Lobby', liveState: 'polling', expected: 'inGame' },
    { name: 'in game with client crashed', lcuConnected: false, lcuPhase: null, liveState: 'polling', expected: 'inGame' },
    { name: 'post game (WaitingForStats)', lcuConnected: true, lcuPhase: 'WaitingForStats', liveState: 'unavailable', expected: 'postGame' },
    { name: 'post game (EndOfGame)', lcuConnected: true, lcuPhase: 'EndOfGame', liveState: 'unavailable', expected: 'postGame' },
    { name: 'unknown future phase', lcuConnected: true, lcuPhase: 'SomeNewPhase', liveState: 'unavailable', expected: 'clientOpen' }
  ]

  it.each(cases)('$name → $expected', ({ lcuConnected, lcuPhase, liveState, expected }) => {
    expect(computeSessionPhase({ lcuConnected, lcuPhase, liveState })).toBe(expected)
  })
})

describe('SessionMachine', () => {
  it('walks the full cycle idle→clientOpen→champSelect→inGame→postGame→clientOpen', () => {
    const emitted: SessionPhase[] = []
    const machine = new SessionMachine((phase) => emitted.push(phase))

    machine.setLcuConnected(true)
    machine.setLcuPhase('Lobby')
    machine.setLcuPhase('Matchmaking')
    machine.setLcuPhase('ChampSelect')
    machine.setLcuPhase('InProgress')
    machine.setLiveState('polling') // game actually starts
    machine.setLiveState('unavailable') // game process closes
    machine.setLcuPhase('WaitingForStats')
    machine.setLcuPhase('EndOfGame')
    machine.setLcuPhase('None')

    // Note the clientOpen between champSelect and inGame: the loading screen
    // (LCU InProgress, port :2999 not answering yet).
    expect(emitted).toEqual([
      'clientOpen',
      'champSelect',
      'clientOpen',
      'inGame',
      'clientOpen',
      'postGame',
      'clientOpen'
    ])
  })

  it('client kill mid-cycle returns to idle and reconnect recovers', () => {
    const emitted: SessionPhase[] = []
    const machine = new SessionMachine((phase) => emitted.push(phase))

    machine.setLcuConnected(true)
    machine.setLcuPhase('ChampSelect')
    machine.setLcuConnected(false) // client killed
    expect(machine.getPhase()).toBe('idle')

    machine.setLcuConnected(true) // client restarted (stale phase cleared)
    expect(machine.getPhase()).toBe('clientOpen')
    expect(emitted).toEqual(['clientOpen', 'champSelect', 'idle', 'clientOpen'])
  })

  it('only emits on change', () => {
    const emitted: SessionPhase[] = []
    const machine = new SessionMachine((phase) => emitted.push(phase))
    machine.setLcuConnected(true)
    machine.setLcuPhase('Lobby')
    machine.setLcuPhase('Matchmaking')
    machine.setLcuPhase('ReadyCheck')
    expect(emitted).toEqual(['clientOpen'])
  })

  it('groups all known LCU phases', () => {
    expect(groupLcuPhase('ChampSelect')).toBe('champSelect')
    expect(groupLcuPhase('GameStart')).toBe('inGameIntent')
    expect(groupLcuPhase('Reconnect')).toBe('inGameIntent')
    expect(groupLcuPhase('PreEndOfGame')).toBe('postGame')
    expect(groupLcuPhase('TerminatedInError')).toBe('other')
  })
})
