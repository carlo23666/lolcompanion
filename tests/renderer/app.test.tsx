import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { IpcEventChannel, IpcEventChannels, RendererApi } from '@shared/ipc'
import type { LiveClientSnapshot } from '@shared/schemas/liveclient'
import { allGameDataSchema } from '@shared/schemas/liveclient'
import App from '@renderer/App'
import rawSample from '../../fixtures/liveclientdata_sample.json'

const sample: LiveClientSnapshot = allGameDataSchema.parse(rawSample)

interface ApiStub {
  api: RendererApi
  invoke: ReturnType<typeof vi.fn>
  emit<C extends IpcEventChannel>(channel: C, payload: IpcEventChannels[C]): void
}

function stubApi(): ApiStub {
  const listeners = new Map<string, ((payload: unknown) => void)[]>()
  const invoke = vi.fn().mockResolvedValue({ pong: true, version: '0.1.0-test' })
  const api: RendererApi = {
    invoke,
    on(channel, listener) {
      const list = listeners.get(channel) ?? []
      list.push(listener as (payload: unknown) => void)
      listeners.set(channel, list)
      return () => void 0
    }
  }
  vi.stubGlobal('api', api)
  return {
    api,
    invoke,
    emit: (channel, payload) => {
      for (const listener of listeners.get(channel) ?? []) listener(payload)
    }
  }
}

describe('App', () => {
  it('renders the title and shows the version returned by app:ping', async () => {
    const stub = stubApi()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'LoL Companion' })).toBeInTheDocument()
    expect(await screen.findByText(/0\.1\.0-test/)).toBeInTheDocument()
    expect(stub.invoke).toHaveBeenCalledWith('app:ping')
  })

  it('shows the idle message while no game is running', () => {
    stubApi()
    render(<App />)
    expect(screen.getByText(/Sin partida en curso/)).toBeInTheDocument()
  })

  it('renders game clock and player list when snapshots arrive', () => {
    const stub = stubApi()
    render(<App />)
    act(() => {
      stub.emit('live:state', 'polling')
      stub.emit('live:snapshot', sample)
    })
    expect(screen.getByText('Annie')).toBeInTheDocument()
    expect(screen.getByText(/0:00/)).toBeInTheDocument()
  })
})
