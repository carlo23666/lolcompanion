import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import Mascot, { useTheme } from '@renderer/components/Mascot'

function ThemeProbe(): React.JSX.Element {
  return <span data-testid="theme">{useTheme()}</span>
}

describe('Mascot (per-theme sprite)', () => {
  it('mood follows the session phase (default: Bitxo, recreativa)', () => {
    const { rerender } = render(<Mascot phase="idle" />)
    expect(screen.getByRole('img', { name: /Bitxo/, hidden: true })).toHaveAttribute('data-mood', 'sleepy')

    rerender(<Mascot phase="champSelect" />)
    expect(screen.getByRole('img', { name: /Bitxo/, hidden: true })).toHaveAttribute('data-mood', 'hyped')

    rerender(<Mascot phase="inGame" />)
    expect(screen.getByRole('img', { name: /Bitxo/, hidden: true })).toHaveAttribute('data-mood', 'focused')
  })

  it('the mascot swaps live with the theme (Kumo on sakura, Byte on cabina)', () => {
    render(
      <>
        <Mascot phase="idle" />
        <ThemeProbe />
      </>
    )
    act(() => {
      window.dispatchEvent(new CustomEvent('app-theme', { detail: 'sakura' }))
    })
    expect(screen.getByTestId('theme').textContent).toBe('sakura')
    expect(screen.getByRole('img', { name: /Kumo/, hidden: true })).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new CustomEvent('app-theme', { detail: 'cabina' }))
    })
    expect(screen.getByRole('img', { name: /Byte/, hidden: true })).toBeInTheDocument()
  })

  it('shows a speech bubble on phase change', () => {
    const { container } = render(<Mascot phase="champSelect" />)
    // One of the champ-select phrases is visible right after the change.
    expect(container.textContent).toMatch(/pick|A por todas|👀/i)
  })
})
