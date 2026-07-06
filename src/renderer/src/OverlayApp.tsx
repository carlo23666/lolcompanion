import { useEffect, useRef, useState } from 'react'
import type { Recommendation } from '@shared/recommendation'
import { HexiSprite } from './components/Mascot'
import { PersonalCurveChip, TeamGoldBar, usePersonalCurve } from './components/LiveInsights'
import { useIpcEvent, useLiveInsights, type LiveAlert } from './hooks'

const ACTION_LABEL: Record<string, string> = {
  prioritize: 'COMPRA YA',
  add: 'PRÓXIMA COMPRA',
  delay: 'ESPERA',
  replace: 'VENDE Y CAMBIA'
}

const ALERT_SHOW_MS = 6000
// Walk-in Hexi: enter, speak, leave (full sentences need reading time).
const COACH_STAY_MS = 10_500
const COACH_LEAVE_MS = 1300

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
  if (props.spawnS === null) return null
  const remaining = props.spawnS - props.now
  const live = remaining <= 0
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
        live
          ? 'objective-live bg-emerald-500/20 text-emerald-300'
          : remaining <= 60
            ? 'bg-amber-400/15 text-amber-300'
            : 'bg-slate-800/80 text-slate-400'
      }`}
    >
      {props.icon} {live ? `${props.label} VIVO` : formatClock(remaining)}
    </span>
  )
}

function RecommendationRow(props: { rec: Recommendation; hero: boolean }): React.JSX.Element {
  const { rec, hero } = props
  return (
    <div
      className={`flex items-center gap-2 rounded px-1.5 py-1 ${
        hero ? 'bg-amber-400/10' : 'bg-slate-900/60'
      }`}
    >
      {rec.itemId !== null && (
        <img
          src={`ddicon://item/${String(rec.itemId)}.png`}
          alt=""
          className={`rounded border border-slate-700 ${hero ? 'h-8 w-8' : 'h-6 w-6'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold text-slate-100 ${hero ? 'text-xs' : 'text-[11px]'}`}>
          {rec.itemName ?? rec.category}{' '}
          <span className="text-[9px] font-bold text-indigo-300">
            {ACTION_LABEL[rec.action] ?? ''}
          </span>
        </p>
        {hero && rec.reasons[0] !== undefined && (
          <p className="truncate text-[10px] text-slate-400">{rec.reasons[0]}</p>
        )}
      </div>
    </div>
  )
}

/**
 * In-game overlay (transparent always-on-top window, ?overlay=1): compact
 * Hexi bubble with the top recommendation, interrupted by spike/objective
 * alerts. Hovering expands a stats panel (top-3 recs, objective timers,
 * personal CS curve, team gold, latest alerts); 📌 keeps it open. The window
 * is click-through except while the pointer is over the card
 * (`overlay:interactive`), so it never eats game clicks.
 */
export default function OverlayApp(): React.JSX.Element | null {
  const recommendations = useIpcEvent('gamestate:recommendations')
  const gameState = useIpcEvent('gamestate:update')
  const insights = useLiveInsights()
  const curve = usePersonalCurve(gameState)
  const [activeAlert, setActiveAlert] = useState<LiveAlert | null>(null)
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const lastAlertIdRef = useRef(0)

  // A new spike/objective alert takes over the bubble for a few seconds.
  // Coach tips get their own walk-in Hexi instead (too much in one place).
  useEffect(() => {
    const newest = insights.alerts[0]
    if (!newest || newest.id === lastAlertIdRef.current) return
    lastAlertIdRef.current = newest.id
    if (newest.kind !== 'spike' && newest.kind !== 'objective') return
    setActiveAlert(newest)
    const timer = setTimeout(() => setActiveAlert(null), ALERT_SHOW_MS)
    return () => clearTimeout(timer)
  }, [insights.alerts])

  // Coach tip lifecycle: walk in → speak → walk out.
  const [walkTip, setWalkTip] = useState<{ text: string; leaving: boolean } | null>(null)
  useEffect(
    () => window.api.on('coach:tip', (tip) => setWalkTip({ text: tip.text, leaving: false })),
    []
  )
  useEffect(() => {
    if (walkTip === null) return
    const timer = walkTip.leaving
      ? setTimeout(() => setWalkTip(null), COACH_LEAVE_MS)
      : setTimeout(() => setWalkTip((current) => (current ? { ...current, leaving: true } : null)), COACH_STAY_MS)
    return () => clearTimeout(timer)
  }, [walkTip])

  const top = recommendations?.recommendations[0]
  const expanded = hovered || pinned
  const now = gameState?.gameTimeS ?? 0

  const setInteractive = (interactive: boolean): void => {
    void window.api.invoke('overlay:interactive', interactive).catch(() => undefined)
  }

  return (
    <div className="relative flex h-screen w-screen flex-col justify-start bg-transparent p-1">
      <div
        onMouseEnter={() => {
          setHovered(true)
          setInteractive(true)
        }}
        onMouseLeave={() => {
          setHovered(false)
          if (!pinned) setInteractive(false)
        }}
      >
        <div
          className="flex cursor-move items-center justify-between px-2 py-0.5"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <span className="rounded bg-slate-950/70 px-1.5 text-[9px] font-bold tracking-widest text-amber-300/90 uppercase">
            LoL Companion
          </span>
          <span className="rounded bg-slate-950/70 px-1.5 text-[9px] text-slate-500">
            {expanded ? 'arrastra para mover' : 'pasa el ratón para ampliar'}
          </span>
        </div>

        <div className="flex items-start gap-1.5">
          <HexiSprite
            mood="focused"
            alerting={activeAlert !== null}
            className="h-12 w-12 shrink-0 drop-shadow-[0_0_6px_rgba(10,155,180,0.5)]"
          />

          {activeAlert !== null ? (
            <div
              className={`alert-in min-w-0 flex-1 rounded-lg border bg-slate-950/90 px-2.5 py-1.5 shadow-lg backdrop-blur-sm ${
                activeAlert.kind === 'objective' ? 'border-emerald-500/60' : 'border-amber-400/60'
              }`}
            >
              <p
                className={`text-xs font-semibold ${
                  activeAlert.kind === 'objective' ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {activeAlert.kind === 'objective' ? '🎯' : '⚠'} {activeAlert.text}
              </p>
            </div>
          ) : top ? (
            <div className="card-in flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-amber-400/40 bg-slate-950/90 px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
              {top.itemId !== null && (
                <img
                  src={`ddicon://item/${String(top.itemId)}.png`}
                  alt=""
                  className="h-9 w-9 rounded border border-slate-700"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {top.itemName ?? top.category}{' '}
                  <span className="text-[10px] font-bold text-indigo-300">
                    {ACTION_LABEL[top.action] ?? ''}
                  </span>
                </p>
                {top.reasons[0] !== undefined && (
                  <p className="truncate text-[11px] text-slate-400">{top.reasons[0]}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1 rounded-lg border border-slate-700/60 bg-slate-950/90 px-2.5 py-1.5">
              <p className="text-[11px] text-slate-500">Esperando recomendación…</p>
            </div>
          )}
        </div>

        {expanded && (
          <div
            data-testid="overlay-expanded"
            className="card-in mt-1.5 flex flex-col gap-2 rounded-lg border border-slate-700/70 bg-slate-950/95 p-2.5 shadow-xl backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Panel de partida
              </span>
              <button
                type="button"
                aria-pressed={pinned}
                title={pinned ? 'Dejar de fijar' : 'Fijar panel abierto'}
                onClick={() => setPinned((value) => !value)}
                className={`rounded px-1.5 py-0.5 text-[11px] ${
                  pinned ? 'bg-amber-400/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}
              >
                📌
              </button>
            </div>

            {gameState !== null && (
              <>
                <div className="flex items-center gap-2 font-mono text-[11px] text-slate-300">
                  <span>⏱ {formatClock(now)}</span>
                  <span className="text-amber-300">
                    💰 {Math.round(gameState.self.currentGold)}
                  </span>
                  <span>
                    {gameState.self.scores.kills}/{gameState.self.scores.deaths}/
                    {gameState.self.scores.assists}
                  </span>
                  <span>{gameState.self.scores.creepScore} CS</span>
                  <PersonalCurveChip gameState={gameState} curve={curve} />
                </div>
                <div className="flex items-center gap-1.5">
                  <ObjectiveChip icon="🐉" label="dragón" spawnS={insights.nextDragonS} now={now} />
                  <ObjectiveChip icon="🟣" label="Barón" spawnS={insights.nextBaronS} now={now} />
                  <div className="min-w-16 flex-1">
                    <TeamGoldBar gameState={gameState} />
                  </div>
                </div>
              </>
            )}

            {recommendations !== null && recommendations.recommendations.length > 0 && (
              <div className="flex flex-col gap-1">
                {recommendations.recommendations.slice(0, 3).map((rec, index) => (
                  <RecommendationRow
                    key={`${String(rec.itemId ?? rec.category)}-${String(index)}`}
                    rec={rec}
                    hero={index === 0}
                  />
                ))}
              </div>
            )}

            {insights.alerts.length > 0 && (
              <div className="flex flex-col gap-0.5">
                {insights.alerts.slice(0, 3).map((alert) => (
                  <p key={alert.id} className="truncate text-[10px] text-slate-500">
                    <span className="font-mono">{formatClock(alert.gameTimeS)}</span> ·{' '}
                    {alert.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Walk-in Hexi: enters from the right edge, delivers the macro tip,
          walks out. Separate from the alert bubble so the tip never competes
          with recommendations for the same spot. */}
      {walkTip !== null && (
        <div
          data-testid="coach-walk"
          className={`pointer-events-none absolute right-1 bottom-1 flex max-w-[370px] items-end gap-1.5 ${
            walkTip.leaving ? 'hexi-walk-out' : 'hexi-walk-in'
          }`}
        >
          <div className="min-w-0 rounded-lg rounded-br-none border border-indigo-500/60 bg-slate-950/95 px-3 py-2 shadow-xl backdrop-blur-sm">
            <p className="text-xs leading-snug font-medium text-indigo-200">🔮 {walkTip.text}</p>
          </div>
          <HexiSprite
            mood="hyped"
            className="h-14 w-14 shrink-0 drop-shadow-[0_0_8px_rgba(127,212,228,0.6)]"
          />
        </div>
      )}
    </div>
  )
}
