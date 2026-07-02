/**
 * Synthesized UI sounds (WebAudio, no assets, no licensing). Gated by the
 * persisted `soundsEnabled` setting; call setSoundsEnabled() on load/save.
 */

let enabled = false
let context: AudioContext | null = null

export function setSoundsEnabled(value: boolean): void {
  enabled = value
}

function audio(): AudioContext {
  context ??= new AudioContext()
  return context
}

function tone(
  frequency: number,
  startS: number,
  durationS: number,
  peakGain: number,
  type: OscillatorType = 'triangle'
): void {
  const ctx = audio()
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  const t0 = ctx.currentTime + startS
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationS)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(t0)
  oscillator.stop(t0 + durationS + 0.05)
}

/** Soft two-note gold chime — new top recommendation. */
export function playRecommendation(): void {
  if (!enabled) return
  tone(660, 0, 0.22, 0.05)
  tone(990, 0.09, 0.3, 0.045)
}

/** Double low blip — enemy power spike alert. */
export function playAlert(): void {
  if (!enabled) return
  tone(330, 0, 0.12, 0.055, 'square')
  tone(330, 0.16, 0.12, 0.055, 'square')
}
