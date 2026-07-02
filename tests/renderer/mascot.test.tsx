import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Mascot from '@renderer/components/Mascot'

describe('Mascot (Hexi)', () => {
  it('mood follows the session phase', () => {
    const { rerender } = render(<Mascot phase="idle" />)
    expect(screen.getByRole('img', { name: /Hexi/, hidden: true })).toHaveAttribute('data-mood', 'sleepy')

    rerender(<Mascot phase="champSelect" />)
    expect(screen.getByRole('img', { name: /Hexi/, hidden: true })).toHaveAttribute('data-mood', 'hyped')

    rerender(<Mascot phase="inGame" />)
    expect(screen.getByRole('img', { name: /Hexi/, hidden: true })).toHaveAttribute('data-mood', 'focused')
  })

  it('shows a speech bubble on phase change', () => {
    const { container } = render(<Mascot phase="champSelect" />)
    // One of the champ-select phrases is visible right after the change.
    expect(container.textContent).toMatch(/pick|A por todas|👀/i)
  })
})
