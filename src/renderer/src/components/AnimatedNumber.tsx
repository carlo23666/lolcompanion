import { useEffect, useRef, useState } from 'react'

/**
 * Number that tweens toward its target instead of jumping — the counting
 * gold effect. Falls back to an instant jump under prefers-reduced-motion.
 */
export default function AnimatedNumber(props: {
  value: number
  durationMs?: number
}): React.JSX.Element {
  const { value, durationMs = 600 } = props
  const [displayed, setDisplayed] = useState(value)
  const displayedRef = useRef(value)
  const frameRef = useRef(0)

  useEffect(() => {
    // matchMedia is missing under jsdom (tests) — treat as reduced motion.
    const reduced =
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = displayedRef.current
    const delta = value - from
    if (reduced || delta === 0 || Math.abs(delta) < 2) {
      displayedRef.current = value
      setDisplayed(value)
      return
    }
    const startedAt = performance.now()
    const step = (now: number): void => {
      const t = Math.min(1, (now - startedAt) / durationMs)
      const eased = 1 - (1 - t) * (1 - t) // ease-out
      const next = Math.round(from + delta * eased)
      displayedRef.current = next
      setDisplayed(next)
      if (t < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, durationMs])

  return <>{displayed}</>
}
