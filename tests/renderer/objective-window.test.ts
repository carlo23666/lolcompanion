import { describe, expect, it } from 'vitest'
import { objectiveWindowText } from '../../src/renderer/src/hooks'

const jungler = { championName: 'Kayn', isJungler: true }
const laner = { championName: 'Zed', isJungler: false }

describe('objectiveWindowText', () => {
  it('enemy jungler dead + dragon on the map → window alert', () => {
    // Dragon spawned at 300, now 400 → on the map.
    const text = objectiveWindowText([jungler], 400, 300, 1200)
    expect(text).toContain('Kayn (jungla enemiga) ha muerto')
    expect(text).toContain('dragón libre')
  })

  it('single laner death → no alert (too noisy)', () => {
    expect(objectiveWindowText([laner], 400, 300, 1200)).toBeNull()
  })

  it('two enemies dead + dragon spawning soon → countdown alert', () => {
    const text = objectiveWindowText([laner, { ...laner, championName: 'Ahri' }], 400, 430, 1200)
    expect(text).toContain('2 enemigos han muerto')
    expect(text).toContain('dragón sale en 0:30')
  })

  it('no objective up or close → null even with the jungler dead', () => {
    expect(objectiveWindowText([jungler], 400, 700, 1200)).toBeNull()
  })

  it('baron takes precedence over dragon after 20 min', () => {
    // Both up: baron (spawned 1200) and dragon (spawned 1250), now 1300.
    const text = objectiveWindowText([jungler], 1300, 1250, 1200)
    expect(text).toContain('Barón libre')
  })

  it('baron ignored before its first spawn window', () => {
    const text = objectiveWindowText([jungler], 400, 300, 1200)
    expect(text).not.toContain('Barón')
  })
})
