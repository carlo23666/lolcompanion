import { useEffect, useId, useRef, useState } from 'react'
import type { SessionPhase } from '@shared/session'
import type { MessageKey } from '@shared/i18n'
import { DEFAULT_THEME, mascotNameFor, normalizeTheme } from '@shared/themes'
import { useT } from '../i18n'

export type Mood = 'sleepy' | 'idle' | 'hyped' | 'focused'

const MOOD_BY_PHASE: Record<SessionPhase, Mood> = {
  idle: 'sleepy',
  clientOpen: 'idle',
  champSelect: 'hyped',
  inGame: 'focused',
  postGame: 'idle'
}

const PHRASE_KEYS: Record<SessionPhase, readonly MessageKey[]> = {
  idle: ['mascot.idle.1', 'mascot.idle.2', 'mascot.idle.3'],
  clientOpen: ['mascot.clientOpen.1', 'mascot.clientOpen.2', 'mascot.clientOpen.3'],
  champSelect: ['mascot.champSelect.1', 'mascot.champSelect.2', 'mascot.champSelect.3'],
  inGame: ['mascot.inGame.1', 'mascot.inGame.2', 'mascot.inGame.3'],
  postGame: ['mascot.postGame.1', 'mascot.postGame.2', 'mascot.postGame.3']
}

/**
 * Active theme id, live: applyTheme() (App.tsx) dispatches 'app-theme' on
 * every change. One identity today, but the hook stays — it is the single
 * place the renderer learns about identity switches.
 */
export function useTheme(): string {
  const [theme, setTheme] = useState(
    () => normalizeTheme(document.documentElement.dataset['theme']) || DEFAULT_THEME
  )
  useEffect(() => {
    const onChange = (event: Event): void => {
      setTheme(normalizeTheme((event as CustomEvent<string>).detail))
    }
    window.addEventListener('app-theme', onChange)
    return () => window.removeEventListener('app-theme', onChange)
  }, [])
  return theme
}

/** The identity's mascot/persona name. */
export function useMascotName(): string {
  return mascotNameFor(useTheme())
}

/*
 * Three hand-built SVG characters, smooth vector + CSS animated (no pixels).
 * Each is a self-contained markup string so the geometry stays exactly as
 * designed; a per-instance `uid` namespaces every gradient/clip id so several
 * mascots can share the page without their <defs> colliding. Motion lives in
 * main.css, keyed off the .masc[data-mood] classes and the part classes
 * (.eye, .gill, .tail, .hair-l/.hair-r, .spark, .glow-eye, .zzz).
 */

function fourStar(x: number, y: number, r: number, cls = ''): string {
  const k = r * 0.3
  return `<path class="${cls}" d="M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z"/>`
}
function sleepZ(x: number, y: number, fill: string): string {
  return `<g class="zzz" fill="${fill}" font-family="'Chakra Petch', sans-serif" font-weight="700"><text x="${x}" y="${y}" font-size="9">z</text><text x="${x + 6}" y="${y - 7}" font-size="6">z</text></g>`
}
function petalShape(x: number, y: number, cls = ''): string {
  return `<path class="${cls}" transform="translate(${x} ${y})" d="M0 -4 C 2 -2 2 1 0 4 C -2 1 -2 -2 0 -4 Z"/>`
}
function blossom(): string {
  let out = ''
  for (let i = 0; i < 5; i++)
    out += `<path transform="rotate(${i * 72})" d="M0 0 C 2.6 -2 2.6 -6 0 -8 C -2.6 -6 -2.6 -2 0 0 Z"/>`
  return out + '<circle r="1.4" fill="#ffe08a"/>'
}

/* ----- Bitxo (neón): smooth cartoon axolotl, waving gill fronds ----- */
function bitxoSvg(mood: Mood, uid: string): string {
  const id = `bx-${uid}-${mood}`
  const gill = (bx: number, by: number, deg: number): string =>
    `<g transform="translate(${bx} ${by}) rotate(${deg})"><g class="gill"><path d="M0 0 C -4 -7 -4 -15 0 -22 C 4 -15 4 -7 0 0 Z" fill="url(#${id}-gill)"/><path d="M0 -2 C -2 -8 -2 -13 0 -19" stroke="#ff4f86" stroke-width="1" fill="none" opacity=".5"/></g></g>`
  const eyes =
    mood === 'sleepy'
      ? `<path d="M32 47 q7 6 14 0" stroke="#b04d78" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M54 47 q7 6 14 0" stroke="#b04d78" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
      : `<g class="eye"><ellipse cx="39" cy="47" rx="6.4" ry="8.4" fill="#3b2340"/><circle cx="41.4" cy="43.6" r="2.5" fill="#fff"/><circle cx="37.6" cy="49.4" r="1.2" fill="#fff" opacity=".85"/></g><g class="eye"><ellipse cx="61" cy="47" rx="6.4" ry="8.4" fill="#3b2340"/><circle cx="63.4" cy="43.6" r="2.5" fill="#fff"/><circle cx="59.6" cy="49.4" r="1.2" fill="#fff" opacity=".85"/></g>`
  const brows =
    mood === 'focused'
      ? `<path d="M31 36 l11 3 M69 36 l-11 3" stroke="#c85a86" stroke-width="2" stroke-linecap="round"/>`
      : ''
  const mouth =
    mood === 'hyped'
      ? `<path d="M42 58 q8 10 16 0 q-8 4 -16 0 Z" fill="#c0446f"/><path d="M46 62 q4 3 8 0" fill="#ff8fae"/>`
      : mood === 'focused'
        ? `<path d="M44 60 q6 3 12 0" stroke="#b04d78" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
        : `<path d="M43 59 q7 5 14 0" stroke="#b04d78" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
  const band =
    mood === 'focused'
      ? `<g><rect x="20" y="30" width="60" height="7.5" rx="3.2" fill="url(#${id}-gold)"/><path d="M20 33 l-7 -3 2 9 z" fill="url(#${id}-gold)"/><circle cx="50" cy="33.6" r="2.4" fill="#fff3cf"/></g>`
      : ''
  const extras =
    mood === 'hyped'
      ? `<g fill="#ffd77e">${fourStar(20, 26, 4, 'spark')}${fourStar(82, 34, 3.4, 'spark')}${fourStar(74, 16, 2.8, 'spark')}</g>`
      : mood === 'sleepy'
        ? sleepZ(76, 30, '#c98fb0')
        : ''
  return `<svg viewBox="0 0 100 100" class="masc" data-mood="${mood}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${id}-body" cx="50%" cy="34%" r="72%"><stop offset="0%" stop-color="#ffc9de"/><stop offset="68%" stop-color="#ff9dc0"/><stop offset="100%" stop-color="#f176a4"/></radialGradient><radialGradient id="${id}-belly" cx="50%" cy="38%" r="66%"><stop offset="0%" stop-color="#fff4f8"/><stop offset="100%" stop-color="#ffdcea"/></radialGradient><linearGradient id="${id}-gill" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#ff5d8f"/><stop offset="100%" stop-color="#ff9ec0"/></linearGradient><linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffe6a3"/><stop offset="100%" stop-color="#f2c14e"/></linearGradient></defs><g>${gill(24, 40, -46)}${gill(19, 54, -74)}${gill(24, 68, -104)}${gill(76, 40, 46)}${gill(81, 54, 74)}${gill(76, 68, 104)}</g><ellipse cx="38" cy="90" rx="7" ry="5" fill="url(#${id}-body)"/><ellipse cx="62" cy="90" rx="7" ry="5" fill="url(#${id}-body)"/><ellipse class="tail" cx="24" cy="74" rx="6" ry="4.5" fill="url(#${id}-body)"/><ellipse cx="76" cy="74" rx="6" ry="4.5" fill="url(#${id}-body)"/><ellipse cx="50" cy="72" rx="22" ry="18" fill="url(#${id}-body)"/><ellipse cx="50" cy="46" rx="31" ry="28" fill="url(#${id}-body)"/><ellipse cx="50" cy="70" rx="14" ry="14" fill="url(#${id}-belly)"/><ellipse cx="30" cy="54" rx="4.6" ry="3.2" fill="#ff7ba6" opacity=".55"/><ellipse cx="70" cy="54" rx="4.6" ry="3.2" fill="#ff7ba6" opacity=".55"/>${brows}${eyes}${mouth}${band}${extras}</svg>`
}

/* ----- Sombra (abismo): sleek shadow cat, neon-crimson rim + slit eyes ----- */
function sombraSvg(mood: Mood, uid: string): string {
  const id = `sb-${uid}-${mood}`
  const body =
    'M50 88 C22 88 15 66 17 52 C12 45 11 30 15 23 L30 40 C42 33 58 33 70 40 L85 23 C89 30 88 45 83 52 C85 66 78 88 50 88 Z'
  const eye = (cx: number): string =>
    mood === 'sleepy'
      ? `<path d="M${cx - 4} 45 q4 3 8 0" stroke="#e3244a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
      : mood === 'focused'
        ? `<g class="glow-eye" color="#ff2d55"><path d="M${cx - 5} 45 q5 -4 10 0 q-5 3 -10 0 Z" fill="url(#${id}-eye)"/><rect x="${cx - 1}" y="41.5" width="2" height="7" rx="1" fill="#1a0a10"/></g>`
        : `<g class="eye glow-eye" color="#ff2d55"><ellipse cx="${cx}" cy="45" rx="${mood === 'hyped' ? 4.4 : 3.8}" ry="${mood === 'hyped' ? 5 : 5.6}" fill="url(#${id}-eye)"/><rect x="${cx - 1}" y="40" width="2" height="10" rx="1" fill="#1a0a10"/><circle cx="${cx + 1.4}" cy="42.6" r="1.1" fill="#ffd0d9"/></g>`
  const extras =
    mood === 'hyped'
      ? `<g fill="#ff5a74">${fourStar(20, 30, 3.4, 'spark')}${fourStar(82, 36, 3, 'spark')}</g>`
      : mood === 'sleepy'
        ? sleepZ(78, 28, '#8a3346')
        : ''
  const earPerk = mood === 'hyped' ? -3 : 0
  return `<svg viewBox="0 0 100 100" class="masc" data-mood="${mood}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}-fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#191722"/><stop offset="100%" stop-color="#080810"/></linearGradient><radialGradient id="${id}-eye" cx="50%" cy="38%" r="70%"><stop offset="0%" stop-color="#ff8a9c"/><stop offset="55%" stop-color="#ff2d55"/><stop offset="100%" stop-color="#a3122e"/></radialGradient></defs><g transform="translate(0 ${earPerk})" opacity=".9"><path d="${body}" fill="none" stroke="#e3244a" stroke-width="2.4" opacity=".55" filter="drop-shadow(0 0 4px #e3244a)"/></g><path class="tail" d="M76 82 C90 80 92 62 84 54 C88 64 82 74 72 78 Z" fill="url(#${id}-fur)"/><g transform="translate(0 ${earPerk})"><path d="${body}" fill="url(#${id}-fur)"/><ellipse cx="50" cy="44" rx="27" ry="21" fill="#181622" opacity=".85"/><path d="M20 27 l5 11 6 -5 z" fill="#5c1024"/><path d="M80 27 l-5 11 -6 -5 z" fill="#5c1024"/><path d="M50 86 C40 86 36 74 40 66 C44 74 56 74 60 66 C64 74 60 86 50 86 Z" fill="#12111b"/></g><path d="M30 52 l-14 -3 M30 56 l-14 3 M70 52 l14 -3 M70 56 l14 3" stroke="#4a4a63" stroke-width="1" fill="none" opacity=".7"/><path d="M47 54 h6 l-3 3.4 z" fill="#e3244a"/><path d="M50 57 v3 M50 60 q-3 2 -6 1 M50 60 q3 2 6 1" stroke="#2a2836" stroke-width="1" fill="none"/>${eye(39)}${eye(61)}<path d="M34 64 q16 8 32 0 l-1.5 4.5 q-14.5 6 -29 0 Z" fill="#921530"/><path d="M50 68 l3 4 -3 4 -3 -4 z" fill="#e6cd8d"/>${extras}</svg>`
}

/* ----- Yuki (sakura): nendoroid-chibi anime coach — giant head, tiny body ----- */
function yukiSvg(mood: Mood, uid: string): string {
  const id = `yk-${uid}-${mood}`
  const eye = (cx: number): string => {
    if (mood === 'sleepy')
      return `<path d="M${cx - 8} 45 q8 7 16 0" stroke="#7a4262" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${cx - 8} 44 q8 -2 16 0" stroke="#9a5a80" stroke-width="1" fill="none" stroke-linecap="round"/>`
    const lid = mood === 'focused' ? 3 : 0
    const base = `<ellipse cx="${cx}" cy="45" rx="8.5" ry="10.5"/>`
    const topHi =
      mood === 'hyped'
        ? `<path fill="#fff" d="M${cx - 2.4} 40 l1.6 -3.4 1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6z"/>`
        : `<circle cx="${cx - 2.8}" cy="41" r="4" fill="#fff"/>`
    return `<g><clipPath id="${id}-c${cx}">${base}</clipPath><ellipse cx="${cx}" cy="45" rx="8.5" ry="10.5" fill="#fff8fc" stroke="#eab8d2" stroke-width=".7"/><g clip-path="url(#${id}-c${cx})"><ellipse cx="${cx}" cy="46.6" rx="7.6" ry="9.6" fill="url(#${id}-iris)"/><ellipse cx="${cx}" cy="49.2" rx="2.9" ry="3.9" fill="#331236"/><ellipse cx="${cx}" cy="53" rx="6" ry="2.6" fill="#ffe6f4" opacity=".5"/>${topHi}<circle cx="${cx + 3.2}" cy="51" r="2.1" fill="#fff" opacity=".95"/>${lid ? `<rect x="${cx - 10}" y="34.5" width="20" height="${lid + 3}" fill="#ffe0cd"/>` : ''}</g><path d="M${cx - 8} ${40 + lid} Q${cx} ${36.5 + lid} ${cx + 8} ${40 + lid}" stroke="#4a2340" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M${cx + 8} ${40 + lid} l3 -1.8" stroke="#4a2340" stroke-width="2" fill="none" stroke-linecap="round"/></g>`
  }
  const brow = (x: number, f: number): string =>
    `<path d="M${x} 32 q6 ${f} 12 0" stroke="#c579a0" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/>`
  const mouth =
    mood === 'hyped'
      ? `<path d="M44 59 q6 6 12 0 q-6 2 -12 0 Z" fill="#b83e6e"/><path d="M46 59.6 q4 2.6 8 0" fill="#ff9dc0"/>`
      : mood === 'sleepy'
        ? `<path d="M47 59 q3 2 6 0" stroke="#b0567f" stroke-width="1.5" fill="none" stroke-linecap="round"/>`
        : `<path d="M46 58.6 q4 3.2 8 0" stroke="#b0567f" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
  const arms =
    mood === 'hyped'
      ? `<ellipse cx="26" cy="74" rx="5.5" ry="7" transform="rotate(30 26 74)" fill="#fbe9f1"/><ellipse cx="74" cy="74" rx="5.5" ry="7" transform="rotate(-30 74 74)" fill="#fbe9f1"/>`
      : `<ellipse cx="30" cy="86" rx="5.5" ry="7" fill="#fbe9f1"/><ellipse cx="70" cy="86" rx="5.5" ry="7" fill="#fbe9f1"/>`
  const petals =
    mood === 'hyped'
      ? `<g fill="#ffb3d1">${petalShape(14, 20, 'spark')}${petalShape(88, 26, 'spark')}${petalShape(86, 58, 'spark')}</g>`
      : mood === 'sleepy'
        ? sleepZ(88, 24, '#c98fb0')
        : `<g fill="#ffc4dd" opacity=".85">${petalShape(90, 40)}${petalShape(10, 54)}</g>`
  return `<svg viewBox="0 0 100 100" class="masc" data-mood="${mood}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffd0e6"/><stop offset="48%" stop-color="#f79ac6"/><stop offset="100%" stop-color="#db66a2"/></linearGradient><linearGradient id="${id}-hair2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe3f0"/><stop offset="100%" stop-color="#f4a2cb"/></linearGradient><linearGradient id="${id}-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff3ec"/><stop offset="100%" stop-color="#ffdcc9"/></linearGradient><radialGradient id="${id}-iris" cx="50%" cy="30%" r="78%"><stop offset="0%" stop-color="#b45a9c"/><stop offset="42%" stop-color="#e07ab0"/><stop offset="100%" stop-color="#ffd6ec"/></radialGradient></defs><path class="hair-l" d="M22 44 C6 50 4 74 12 90 C20 82 24 66 30 52 Z" fill="url(#${id}-hair)"/><path class="hair-r" d="M78 44 C94 50 96 74 88 90 C80 82 76 66 70 52 Z" fill="url(#${id}-hair)"/><g>${arms}<path d="M34 78 C34 72 40 70 50 70 C60 70 66 72 66 78 L72 98 L28 98 Z" fill="#fdf1f6"/><path d="M50 70 L42 98 L46 98 L50 80 L54 98 L58 98 Z" fill="#ec6ba0"/><path d="M50 72 l-2.6 3 2.6 3 2.6 -3 z" fill="#b83e6e"/><rect x="30" y="90" width="42" height="4.5" fill="#d9578f" opacity=".85"/></g><path d="M50 4 C20 4 12 28 13 48 C14 60 18 66 24 68 C20 58 22 40 27 32 C34 22 66 22 73 32 C78 40 80 58 76 68 C82 66 86 60 87 48 C88 28 80 4 50 4 Z" fill="url(#${id}-hair)"/><ellipse cx="50" cy="42" rx="24" ry="23" fill="url(#${id}-skin)"/><path d="M26 40 C22 50 24 60 28 66 C30 58 30 48 31 42 Z" fill="url(#${id}-hair2)"/><path d="M74 40 C78 50 76 60 72 66 C70 58 70 48 69 42 Z" fill="url(#${id}-hair2)"/><path d="M26 40 C25 20 38 10 50 10 C62 10 75 20 74 40 C71 30 64 27 60 33 C58 25 52 24 50 24 C48 24 42 25 40 33 C36 27 29 30 26 40 Z" fill="url(#${id}-hair)"/><path d="M40 16 Q50 11 62 17 Q50 21 40 16 Z" fill="#ffe6f1" opacity=".7"/><g transform="translate(74 24) scale(1.15)" fill="#ff8fbf">${blossom()}</g><ellipse cx="34" cy="52" rx="5" ry="3" fill="#ff9dbf" opacity=".55"/><ellipse cx="66" cy="52" rx="5" ry="3" fill="#ff9dbf" opacity=".55"/>${mood === 'focused' ? brow(32, -1) + brow(56, -1) : ''}${eye(38)}${eye(62)}<path d="M50 54 l-1.2 1.8 h2.4 z" fill="#e8b49a" opacity=".6"/>${mouth}${petals}</svg>`
}

/**
 * The active identity's mascot (code-drawn SVG, CSS animated): Bitxo the cartoon
 * axolotl (neón), Sombra the shadow cat (abismo) or Yuki the anime sakura coach
 * (sakura). Exported as HexiSprite so every existing call site keeps working.
 */
export function HexiSprite(props: {
  mood: Mood
  alerting?: boolean
  className?: string
}): React.JSX.Element {
  const theme = useTheme()
  const name = mascotNameFor(theme)
  const rawId = useId()
  const uid = rawId.replace(/[:]/g, '')
  const alerting = props.alerting ?? false
  const mood = alerting ? 'hyped' : props.mood
  const markup =
    theme === 'abismo'
      ? sombraSvg(mood, uid)
      : theme === 'anime'
        ? yukiSvg(mood, uid)
        : bitxoSvg(mood, uid)
  return (
    <span
      role="img"
      aria-label={`${name}, la mascota`}
      className={`hexi inline-block ${props.className ?? 'h-16 w-16'} ${alerting ? 'gold-pulse' : ''}`}
      data-mood={mood}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

/**
 * Mascot in the navigation: mood follows the session phase; speaks a short
 * phrase on phase change and reacts when a spike alert lands.
 */
export default function Mascot(props: {
  phase: SessionPhase
  /** Increment to make the mascot react (e.g. new spike alert). */
  reactKey?: number
}): React.JSX.Element {
  const t = useT()
  const mood = MOOD_BY_PHASE[props.phase]
  const [bubble, setBubble] = useState<string | null>(null)
  const [alerting, setAlerting] = useState(false)
  const phraseIndex = useRef(0)

  useEffect(() => {
    const keys = PHRASE_KEYS[props.phase]
    phraseIndex.current = (phraseIndex.current + 1) % keys.length
    const key = keys[phraseIndex.current]
    setBubble(key ? t(key) : null)
    const timer = setTimeout(() => setBubble(null), 4500)
    return () => clearTimeout(timer)
  }, [props.phase, t])

  useEffect(() => {
    if (props.reactKey === undefined || props.reactKey === 0) return
    setAlerting(true)
    setBubble(t('mascot.alert'))
    const timer = setTimeout(() => {
      setAlerting(false)
      setBubble(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [props.reactKey, t])

  return (
    <div className="neon-dock relative flex items-center gap-2" aria-hidden>
      <HexiSprite mood={mood} alerting={alerting} className="h-14 w-14" />
      {bubble !== null && (
        <div className="pixel-bubble alert-in absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-44 -translate-x-1/2 rounded-lg border border-indigo-800/70 bg-slate-900 px-2 py-1.5 text-center text-slate-300 shadow-lg">
          {bubble}
        </div>
      )}
    </div>
  )
}
