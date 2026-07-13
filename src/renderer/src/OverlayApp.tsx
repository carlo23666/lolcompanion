import { useEffect, useRef, useState } from 'react'
import { DEFAULT_LOCALE, normalizeLocale, type Locale, type MessageKey } from '@shared/i18n'
import type { Recommendation } from '@shared/recommendation'
import { CompanionSprite } from './components/Mascot'
import { useIpcEvent, useLiveInsights, type LiveAlert } from './hooks'
import { LocaleProvider, useT } from './i18n'
import { applyTheme } from './appearance'

const ACTION_LABEL_KEYS: Record<Recommendation['action'], MessageKey> = {
  prioritize: 'rec.action.prioritize',
  add: 'rec.action.add',
  delay: 'rec.action.delay',
  replace: 'rec.action.replace'
}

const ALERT_SHOW_MS = 6000
const COACH_SHOW_MS = 10_500
const DEV_CAPTURE_SIZE =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('capture')

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

function ObjectiveChip(props: {
  icon: string
  label: string
  spawnS: number | null
  now: number
}): React.JSX.Element | null {
  const t = useT()
  if (props.spawnS === null) return null
  const remaining = props.spawnS - props.now
  const live = remaining <= 0
  return (
    <span
      title={props.label}
      className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${
        live
          ? 'objective-live bg-emerald-500/20 text-emerald-300'
          : remaining <= 60
            ? 'bg-amber-400/15 text-amber-300'
            : 'bg-slate-800/80 text-slate-400'
      }`}
    >
      {props.icon} {live ? t('overlay.live') : formatClock(remaining)}
    </span>
  )
}

/**
 * Stable bottom overlay: the active companion and current purchase remain between
 * the ability bar and minimap. Alerts and local-coach tips use one temporary
 * upward bubble; the mascot itself never walks across the game. Only the dock
 * accepts mouse input, preserving click-through behavior elsewhere.
 */
function OverlayContent(): React.JSX.Element {
  const t = useT()
  const recommendations = useIpcEvent('gamestate:recommendations')
  const gameState = useIpcEvent('gamestate:update')
  const insights = useLiveInsights()
  const [speech, setSpeech] = useState<LiveAlert | null>(null)
  const lastAlertIdRef = useRef(0)
  const dragApproachRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const newest = insights.alerts[0]
    if (!newest || newest.id === lastAlertIdRef.current) return
    lastAlertIdRef.current = newest.id
    if (newest.kind === 'info') return
    setSpeech(newest)
    const timer = setTimeout(
      () => setSpeech(null),
      newest.kind === 'coach' ? COACH_SHOW_MS : ALERT_SHOW_MS
    )
    return () => clearTimeout(timer)
  }, [insights.alerts])

  useEffect(
    () =>
      window.api.on('gamestate:reset', () => {
        lastAlertIdRef.current = 0
        setSpeech(null)
      }),
    []
  )

  useEffect(() => {
    const approach = dragApproachRef.current
    if (approach === null) return
    // Electron forwards native mousemove events through a click-through window
    // on Windows, but React's delegated mouseenter/move events are not reliable
    // until the window accepts input. Listen on the real DOM node to bridge it.
    const enableInput = (): void => {
      void window.api.invoke('overlay:interactive', true).catch(() => undefined)
    }
    approach.addEventListener('mousemove', enableInput, { passive: true })
    return () => approach.removeEventListener('mousemove', enableInput)
  }, [])

  useEffect(() => {
    void window.api
      .invoke('overlay:configure', { speechVisible: speech !== null })
      .catch(() => undefined)
  }, [speech])

  const top = recommendations?.recommendations[0]
  const now = gameState?.gameTimeS ?? 0

  const setInteractive = (interactive: boolean): void => {
    void window.api.invoke('overlay:interactive', interactive).catch(() => undefined)
  }

  const stopDrag = (element: HTMLDivElement, pointerId: number): void => {
    if (dragRef.current?.pointerId !== pointerId) return
    dragRef.current = null
    element.releasePointerCapture?.(pointerId)
  }

  return (
    <div
      data-testid="overlay-root"
      style={DEV_CAPTURE_SIZE ? { width: 420, height: 220 } : undefined}
      className="relative flex h-screen w-screen flex-col justify-end gap-2 overflow-hidden bg-transparent p-1 select-none"
    >
      {speech !== null && (
        <div
          data-testid="overlay-speech"
          className={`overlay-speech alert-in pointer-events-none relative max-h-[116px] w-[min(360px,calc(100vw-24px))] self-end rounded-xl border bg-slate-950/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md ${
            speech.kind === 'objective'
              ? 'border-emerald-500/55 text-emerald-100'
              : speech.kind === 'duel'
                ? 'border-cyan-400/55 text-cyan-50'
                : speech.kind === 'spike'
                  ? 'border-amber-400/55 text-amber-100'
                  : speech.kind === 'purchase'
                    ? 'border-pink-400/55 text-slate-100'
                    : 'border-indigo-500/55 text-slate-100'
          }`}
        >
          {speech.itemId !== undefined && speech.itemName !== undefined && (
            <div data-testid="overlay-speech-item" className="mb-1.5 flex items-center gap-2">
              <img
                src={`ddicon://item/${String(speech.itemId)}.png`}
                alt={speech.itemName}
                draggable={false}
                className="h-8 w-8 shrink-0 rounded-md border border-pink-400/35"
              />
              <div className="min-w-0">
                <span className="block font-mono text-[8px] tracking-[0.12em] text-pink-300 uppercase">
                  {t('overlay.itemReference')}
                </span>
                <strong className="block truncate text-[11px] text-slate-50">
                  {speech.itemName}
                </strong>
              </div>
            </div>
          )}
          <p className="text-xs leading-relaxed font-medium">{speech.text}</p>
        </div>
      )}

      <div
        data-testid="overlay-interaction-zone"
        className="relative -mt-5 w-full shrink-0 pt-5"
        onMouseEnter={() => {
          setInteractive(true)
        }}
        onMouseLeave={() => {
          setInteractive(false)
        }}
      >
        {/* Windows cannot re-enable a click-through native window from an
            app-region itself. This transparent approach band receives the
            forwarded hover first, then the native grip can acquire the drag. */}
        <div
          ref={dragApproachRef}
          data-testid="overlay-drag-approach"
          aria-hidden="true"
          className="absolute top-0 right-0 left-0 h-5"
        />
        <div
          data-testid="overlay-dock"
          className="overlay-dock-shell relative flex w-full items-end gap-2 rounded-xl border border-slate-700/65 bg-slate-950/92 px-2.5 pt-5 pb-2 shadow-2xl backdrop-blur-md"
        >
          <div
            data-testid="overlay-drag-handle"
            aria-label={t('overlay.dragMove')}
            title={t('overlay.dragMove')}
            className="overlay-native-drag absolute top-0 right-0 left-0 z-20 flex h-5 cursor-move items-center justify-end rounded-t-xl px-2.5 font-mono text-[9px] tracking-[0.18em] text-slate-500 uppercase"
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture?.(event.pointerId)
              dragRef.current = { pointerId: event.pointerId, x: event.screenX, y: event.screenY }
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current
              if (drag === null || drag.pointerId !== event.pointerId) return
              const x = event.screenX
              const y = event.screenY
              const delta = { x: x - drag.x, y: y - drag.y }
              dragRef.current = { pointerId: event.pointerId, x, y }
              if (delta.x !== 0 || delta.y !== 0) {
                void window.api.invoke('overlay:move', delta).catch(() => undefined)
              }
            }}
            onPointerUp={(event) => stopDrag(event.currentTarget, event.pointerId)}
            onPointerCancel={(event) => stopDrag(event.currentTarget, event.pointerId)}
            onLostPointerCapture={() => {
              dragRef.current = null
            }}
          >
            ···
          </div>

          <div className="min-w-0 flex-1">
            {top ? (
              <div className="flex min-w-0 items-center gap-2">
                {top.itemId !== null && (
                  <img
                    src={`ddicon://item/${String(top.itemId)}.png`}
                    alt=""
                    draggable={false}
                    className="h-10 w-10 shrink-0 rounded-lg border border-slate-700"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate pr-8 text-sm font-semibold text-slate-100">
                    {top.itemName ?? top.category}{' '}
                    <span className="text-[10px] font-bold text-indigo-300">
                      {t(ACTION_LABEL_KEYS[top.action])}
                    </span>
                  </p>
                  {top.reasons[0] !== undefined && (
                    <p className="truncate text-[10px] text-slate-400">{top.reasons[0]}</p>
                  )}
                  {top.plan !== undefined && (
                    <div className="mt-1 flex items-center gap-1" aria-label={t('rec.route')}>
                      {top.plan.steps.map((step, index) => (
                        <span
                          key={`${String(step.itemId)}-${String(index)}`}
                          className={`h-1.5 rounded-full ${
                            step.owned
                              ? 'w-3 bg-emerald-400'
                              : index === top.plan?.currentStep
                                ? 'w-5 bg-amber-300'
                                : 'w-3 bg-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-3 text-[11px] text-slate-500">{t('overlay.waiting')}</p>
            )}

            {gameState !== null && (
              <div className="mt-1.5 flex items-center gap-1.5 border-t border-slate-800/90 pt-1.5 font-mono text-[9px] text-slate-400">
                <span>{formatClock(now)}</span>
                <span className="text-amber-300">{Math.round(gameState.self.currentGold)}g</span>
                <span>
                  {gameState.self.scores.kills}/{gameState.self.scores.deaths}/
                  {gameState.self.scores.assists}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <ObjectiveChip
                    icon="D"
                    label={t('overlay.dragon')}
                    spawnS={insights.nextDragonS}
                    now={now}
                  />
                  <ObjectiveChip
                    icon="B"
                    label={t('overlay.baron')}
                    spawnS={insights.nextBaronS}
                    now={now}
                  />
                </span>
              </div>
            )}
          </div>

          <div className="relative z-10 flex h-16 w-16 shrink-0 items-end justify-center">
            <CompanionSprite
              mood={speech === null ? 'focused' : 'alert'}
              alerting={speech !== null}
              className="h-16 w-16 drop-shadow-[0_0_8px_rgba(127,212,228,0.42)]"
            />
            <div className="absolute right-1 bottom-0 left-1 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The overlay is a separate renderer root and resolves its own locale. */
export default function OverlayApp(): React.JSX.Element {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  useEffect(() => {
    void window.api.invoke('settings:get').then(
      (settings) => {
        setLocale(normalizeLocale(settings?.locale))
        applyTheme(settings.theme)
      },
      () => undefined
    )
    return window.api.on('appearance:theme', applyTheme)
  }, [])
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return (
    <LocaleProvider locale={locale}>
      <OverlayContent />
    </LocaleProvider>
  )
}
