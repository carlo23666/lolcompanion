import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { IpcEventChannel, IpcEventChannels, RendererApi } from '@shared/ipc'
import App from '@renderer/App'

interface ApiStub {
  invoke: ReturnType<typeof vi.fn>
  emit<C extends IpcEventChannel>(channel: C, payload: IpcEventChannels[C]): void
}

export function stubApi(overrides: Record<string, unknown> = {}): ApiStub {
  const listeners = new Map<string, ((payload: unknown) => void)[]>()
  const invoke = vi.fn().mockImplementation((channel: string) => {
    if (channel === 'app:ping') return Promise.resolve({ pong: true, version: '0.1.0' })
    if (channel === 'session:get') return Promise.resolve('idle')
    if (channel === 'settings:get') {
      return Promise.resolve({ riotId: null, platform: 'euw1', recordLive: false, locale: 'es' })
    }
    if (channel in overrides) return Promise.resolve(overrides[channel])
    if (['history:list', 'history:aggregates', 'history:champions'].includes(channel)) {
      return Promise.resolve([])
    }
    if (['history:detail', 'stats:overview', 'stats:curve', 'report:last'].includes(channel)) {
      return Promise.resolve(null)
    }
    return Promise.resolve({})
  })
  const api: RendererApi = {
    invoke: invoke,
    on(channel, listener) {
      const list = listeners.get(channel) ?? []
      list.push(listener as (payload: unknown) => void)
      listeners.set(channel, list)
      return () => void 0
    }
  }
  vi.stubGlobal('api', api)
  return {
    invoke,
    emit: (channel, payload) => {
      act(() => {
        for (const listener of listeners.get(channel) ?? []) listener(payload)
      })
    }
  }
}

describe('App shell', () => {
  it('renders the top bar with the three sections and the idle dashboard', async () => {
    stubApi()
    render(<App />)
    // Nav labels localize once settings resolve (existing installs → es).
    expect(await screen.findByRole('button', { name: 'Historial' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Live' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajustes' })).toBeInTheDocument()
    expect(await screen.findByText('Todo listo cuando vuelvas')).toBeInTheDocument()
  })

  it('navigates between views from the top bar', async () => {
    stubApi()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Historial' }))
    expect(await screen.findByText('Sin partidas guardadas')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Ajustes' }))
    expect(await screen.findByText('Cuenta')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Live' }))
    expect(screen.getByText('Todo listo cuando vuelvas')).toBeInTheDocument()
  })

  it('previews overlay scale and theme changes through typed IPC', async () => {
    const stub = stubApi()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Ajustes' }))
    await user.click(screen.getByRole('checkbox', { name: /Overlay in-game/ }))
    fireEvent.change(screen.getByRole('slider', { name: /Escala/ }), {
      target: { value: '125' }
    })
    expect(stub.invoke).toHaveBeenCalledWith('overlay:configure', { scale: 125 })

    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(stub.invoke).toHaveBeenCalledWith('overlay:configure', { theme: 'dark' })
  })

  it('updates the session indicator from session:phase events', async () => {
    const stub = stubApi()
    render(<App />)
    expect(await screen.findByText('Todo listo cuando vuelvas')).toBeInTheDocument()
    // The compact phase console exposes its full localized label via title.
    stub.emit('session:phase', 'clientOpen')
    expect(screen.getByTitle('Cliente abierto')).toBeInTheDocument()
    stub.emit('session:phase', 'postGame')
    expect(screen.getByTitle('Partida terminada')).toBeInTheDocument()
  })
})
