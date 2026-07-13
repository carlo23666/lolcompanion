import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import Mascot, { useTheme } from '@renderer/components/Mascot'

function ThemeProbe(): React.JSX.Element {
  return <span data-testid="theme">{useTheme()}</span>
}

describe('Mascot', () => {
  it('mood follows the session phase', () => {
    const { rerender } = render(<Mascot phase="idle" />)
    expect(screen.getByRole('img', { name: /Hexi/, hidden: true })).toHaveAttribute(
      'data-mood',
      'sleepy'
    )

    rerender(<Mascot phase="champSelect" />)
    expect(screen.getByRole('img', { name: /Hexi/, hidden: true })).toHaveAttribute(
      'data-mood',
      'thinking'
    )

    rerender(<Mascot phase="inGame" />)
    expect(screen.getByRole('img', { name: /Hexi/, hidden: true })).toHaveAttribute(
      'data-mood',
      'focused'
    )
  })

  it('switches to the companion authored for each identity', () => {
    render(
      <>
        <Mascot phase="idle" />
        <ThemeProbe />
      </>
    )
    expect(screen.getByTestId('theme').textContent).toBe('rift')
    expect(screen.getByRole('img', { name: /Hexi/, hidden: true })).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new CustomEvent('app-theme', { detail: 'abismo' }))
    })
    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(screen.getByRole('img', { name: /Sombra/, hidden: true })).toHaveAttribute(
      'data-mascot',
      'dark'
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('app-theme', { detail: 'anime' }))
    })
    expect(screen.getByTestId('theme').textContent).toBe('sakura')
    expect(screen.getByRole('img', { name: /Kohaku/, hidden: true })).toHaveAttribute(
      'data-mascot',
      'sakura'
    )
  })

  it('maps retired Rift ids without losing Hexi', () => {
    render(
      <>
        <Mascot phase="idle" />
        <ThemeProbe />
      </>
    )
    act(() => {
      window.dispatchEvent(new CustomEvent('app-theme', { detail: 'recreativa' }))
    })
    expect(screen.getByTestId('theme').textContent).toBe('rift')
    expect(screen.getByRole('img', { name: /Hexi/, hidden: true })).toBeInTheDocument()
  })

  it('shows a speech bubble on phase change', () => {
    const { container } = render(<Mascot phase="champSelect" />)
    // One of the champ-select phrases is visible right after the change.
    expect(container.textContent).toMatch(
      /draft|options updated|composition is changing|opciones actualizadas|composición está cambiando/i
    )
  })
})
