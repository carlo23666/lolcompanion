import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RecommendationsPayload } from '@shared/ipc'
import RecommendationCard from '@renderer/components/RecommendationCard'

const payload: RecommendationsPayload = {
  gameTimeS: 900,
  recommendations: [
    {
      itemId: 3123,
      itemName: 'Llamada del verdugo',
      category: null,
      action: 'add',
      score: 62,
      reasons: [
        'Índice de curación enemiga 5.0 (Soraka, Aatrox) — heridas graves reduce su curación un 40%',
        'Llamada del verdugo cuesta 800 de oro y llevas 1250: cómpralo en la próxima base',
        'razón extra',
        'razón que no debe mostrarse (4ª)'
      ]
    },
    {
      itemId: 3026,
      itemName: 'Ángel de la guarda',
      category: null,
      action: 'prioritize',
      score: 55,
      reasons: ['razón GA']
    }
  ]
}

describe('RecommendationCard', () => {
  it('shows the top recommendation with icon, action and top-3 reasons', () => {
    render(<RecommendationCard payload={payload} currentGold={1250} />)
    expect(screen.getByText('Llamada del verdugo')).toBeInTheDocument()
    expect(screen.getByText('PRÓXIMA COMPRA')).toBeInTheDocument()
    expect(screen.getByText(/Índice de curación enemiga 5.0/)).toBeInTheDocument()
    expect(screen.getByText(/cuesta 800 de oro y llevas 1250/)).toBeInTheDocument()
    expect(screen.queryByText(/4ª/)).not.toBeInTheDocument()
    const icon = screen.getByAltText('Llamada del verdugo')
    expect(icon.getAttribute('src')).toBe('ddicon://item/3123.png')
  })

  it('lists secondary recommendations as chips', () => {
    render(<RecommendationCard payload={payload} currentGold={1250} />)
    expect(screen.getByText(/Ángel de la guarda · 55/)).toBeInTheDocument()
  })

  it('records an auditable history when the top recommendation changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<RecommendationCard payload={payload} currentGold={1250} />)
    const changed: RecommendationsPayload = {
      gameTimeS: 960,
      recommendations: [
        {
          itemId: 3031,
          itemName: 'Filo infinito',
          category: null,
          action: 'prioritize',
          score: 80,
          reasons: ['nuevo top']
        }
      ]
    }
    rerender(<RecommendationCard payload={changed} currentGold={2000} />)
    await user.click(screen.getByText(/historial \(2\)/))
    expect(screen.getByText(/15:00 — Llamada del verdugo/)).toBeInTheDocument()
    expect(screen.getByText(/16:00 — Filo infinito/)).toBeInTheDocument()
  })

  it('renders nothing without recommendations', () => {
    const { container } = render(
      <RecommendationCard payload={{ gameTimeS: 10, recommendations: [] }} currentGold={0} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
