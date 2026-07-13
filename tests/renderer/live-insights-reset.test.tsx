import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GameState } from '@shared/gamestate'
import type { IpcEventChannel, IpcEventChannels, RendererApi } from '@shared/ipc'
import { useLiveInsights } from '@renderer/hooks'
import { LocaleProvider } from '@renderer/i18n'
import midGameState from '../../fixtures/gamestate/mid.json'

function stubEvents(): {
  emit<C extends IpcEventChannel>(channel: C, payload: IpcEventChannels[C]): void
} {
  const listeners = new Map<string, ((payload: unknown) => void)[]>()
  const api: RendererApi = {
    invoke: vi.fn().mockResolvedValue(null),
    on(channel, listener) {
      const channelListeners = listeners.get(channel) ?? []
      channelListeners.push(listener as (payload: unknown) => void)
      listeners.set(channel, channelListeners)
      return () => void 0
    }
  }
  vi.stubGlobal('api', api)
  return {
    emit(channel, payload) {
      act(() => {
        for (const listener of listeners.get(channel) ?? []) listener(payload)
      })
    }
  }
}

const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <LocaleProvider locale="es">{children}</LocaleProvider>
)

describe('live insight session boundaries', () => {
  it('clears alerts and enemy-role memory on an explicit reset', () => {
    const stub = stubEvents()
    const { result } = renderHook(() => useLiveInsights(), { wrapper })
    const oldState = structuredClone(midGameState) as unknown as GameState
    oldState.gameTimeS = 700
    const oldEnemy = oldState.enemies[0]
    if (oldEnemy === undefined) throw new Error('fixture missing enemy')
    oldEnemy.championName = 'Ahri'
    oldEnemy.position = 'JUNGLE'
    stub.emit('gamestate:update', oldState)
    stub.emit('coach:tip', { gameTimeS: 700, text: 'Consejo anterior' })
    expect(result.current.alerts).toHaveLength(1)

    stub.emit('gamestate:reset', { atMs: 123 })
    expect(result.current.alerts).toEqual([])

    const newState = structuredClone(midGameState) as unknown as GameState
    newState.gameTimeS = 900
    newState.enemies = newState.enemies.filter((enemy) => enemy.championName !== 'Ahri')
    stub.emit('gamestate:update', newState)
    stub.emit('gamestate:events', [{ type: 'playerDied', championName: 'Ahri', team: 'CHAOS' }])

    // A stale Ahri=JUNGLE cache would fabricate an objective-window alert.
    expect(result.current.alerts).toEqual([])
  })
})
