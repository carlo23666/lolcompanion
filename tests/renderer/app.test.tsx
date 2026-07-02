import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { RendererApi } from '@shared/ipc'
import App from '@renderer/App'

describe('App', () => {
  it('renders the title and shows the version returned by app:ping', async () => {
    const invoke = vi.fn().mockResolvedValue({ pong: true, version: '0.1.0-test' })
    const api: RendererApi = { invoke }
    vi.stubGlobal('api', api)

    render(<App />)
    expect(screen.getByRole('heading', { name: 'LoL Companion' })).toBeInTheDocument()
    expect(await screen.findByText(/0\.1\.0-test/)).toBeInTheDocument()
    expect(invoke).toHaveBeenCalledWith('app:ping')
  })
})
