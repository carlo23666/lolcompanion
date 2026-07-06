/**
 * Synthesized UI sounds (WebAudio, no assets, no licensing). Configured from
 * the persisted sound settings; call configureSounds() on load/save.
 */

export interface SoundCategories {
  recommendation: boolean
  spike: boolean
  objective: boolean
}

interface SoundConfig {
  enabled: boolean
  /** 0-100 master volume; scales every cue's peak gain. */
  volume: number
  categories: SoundCategories
}

let config: SoundConfig = {
  enabled: false,
  volume: 60,
  categories: { recommendation: true, spike: true, objective: true }
}
let context: AudioContext | null = null

export function configureSounds(next: Partial<SoundConfig>): void {
  config = {
    ...config,
    ...next,
    categories: { ...config.categories, ...(next.categories ?? {}) }
  }
}

/** Backwards-compatible master switch (load/save in Ajustes). */
export function setSoundsEnabled(value: boolean): void {
  configureSounds({ enabled: value })
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
  const peak = peakGain * (config.volume / 60) // volume 60 = the original gains
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationS)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(t0)
  oscillator.stop(t0 + durationS + 0.05)
}

/** Soft two-note gold chime — new top recommendation. */
export function playRecommendation(): void {
  if (!config.enabled || !config.categories.recommendation || config.volume === 0) return
  tone(660, 0, 0.22, 0.05)
  tone(990, 0.09, 0.3, 0.045)
}

/** Double low blip — enemy power spike alert. */
export function playAlert(): void {
  if (!config.enabled || !config.categories.spike || config.volume === 0) return
  tone(330, 0, 0.12, 0.055, 'square')
  tone(330, 0.16, 0.12, 0.055, 'square')
}

/** Rising three-note horn — objective window open. */
export function playObjective(): void {
  if (!config.enabled || !config.categories.objective || config.volume === 0) return
  tone(392, 0, 0.16, 0.05, 'sawtooth')
  tone(523, 0.12, 0.16, 0.05, 'sawtooth')
  tone(659, 0.24, 0.28, 0.055, 'sawtooth')
}

/** Ajustes preview: play a short sample of every enabled category. */
export function playPreview(): void {
  if (!config.enabled) return
  if (config.categories.recommendation) playRecommendation()
  if (config.categories.objective) {
    setTimeout(() => playObjective(), 500)
  }
}
