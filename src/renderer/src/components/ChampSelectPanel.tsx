import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChampionMeta, ChampSelectInsights } from '@shared/champselect'
import type { ChampSelectState } from '@shared/schemas/lcu'
import { HexiSprite, useMascotName } from './Mascot'

/** Debounce so a burst of draft updates (pick + ban + intent) costs ONE run. */
const DRAFT_ANALYZE_DEBOUNCE_MS = 1500

/**
 * Local-AI draft advice (Ollama): renders nothing unless the coach is enabled
 * AND reachable. Thinks CONTINUOUSLY — every meaningful draft change (picks,
 * bans, tips) re-runs the analysis, debounced, one request in flight; the
 * previous advice stays visible while Hexi recalculates.
 */
function CoachDraft(props: { insights: ChampSelectInsights }): React.JSX.Element | null {
  const mascot = useMascotName()
  const [ready, setReady] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [advice, setAdvice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const insightsRef = useRef(props.insights)
  insightsRef.current = props.insights
  const inFlightRef = useRef(false)
  const rerunRef = useRef(false)
  const lastAnalyzedRef = useRef('')

  // What "the draft changed" means: visible champions, bans (via tips),
  // splits and the suggestion list — NOT reference identity (insights are
  // re-fetched every LCU tick even when nothing moved).
  const fingerprint = useMemo(
    () =>
      JSON.stringify({
        picks: props.insights.picks.map((pick) => pick.championId),
        tips: props.insights.tips,
        enemy: props.insights.enemySplit,
        ally: props.insights.allySplit,
        plan: props.insights.ownPlan?.championId ?? null
      }),
    [props.insights]
  )

  useEffect(() => {
    void window.api
      .invoke('coach:status')
      .then((status) => setReady(status.enabled && status.available), () => undefined)
  }, [])

  useEffect(() => {
    if (!ready || fingerprint === lastAnalyzedRef.current) return
    const analyze = async (): Promise<void> => {
      if (inFlightRef.current) {
        rerunRef.current = true
        return
      }
      inFlightRef.current = true
      lastAnalyzedRef.current = fingerprint
      setThinking(true)
      setError(null)
      const result = await window.api.invoke('coach:draft', insightsRef.current)
      inFlightRef.current = false
      setThinking(false)
      if (result.ok && result.text !== undefined) setAdvice(result.text)
      else setError(result.error ?? 'error desconocido')
      if (rerunRef.current) {
        // The draft moved while the model was thinking — go again with the
        // latest state.
        rerunRef.current = false
        lastAnalyzedRef.current = ''
        void analyze()
      }
    }
    const timer = setTimeout(() => void analyze(), DRAFT_ANALYZE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [fingerprint, ready])

  if (!ready) return null

  return (
    <div className="rounded border border-indigo-800/60 bg-slate-950/60 p-2">
      <div className="flex items-start gap-2">
        <HexiSprite mood={thinking ? 'focused' : 'idle'} className="h-8 w-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-indigo-300 uppercase">
            🔮 {mascot} analiza el draft{' '}
            {thinking && <span className="animate-pulse text-slate-500">recalculando…</span>}
          </p>
          {advice !== null ? (
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-300">{advice}</p>
          ) : (
            <p className="text-xs text-slate-500">
              {thinking ? 'Pensando…' : 'Esperando cambios en el draft…'}
            </p>
          )}
          {error !== null && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}

const POSITION_LABEL: Record<string, string> = {
  top: 'TOP',
  jungle: 'JG',
  middle: 'MID',
  bottom: 'ADC',
  utility: 'SUP'
}

function ChampionPortrait(props: {
  championId: number
  meta: Record<number, ChampionMeta>
  size?: string
  position?: string
  dimmed?: boolean
}): React.JSX.Element {
  const meta = props.meta[props.championId]
  const size = props.size ?? 'h-12 w-12'
  return (
    <div className="flex flex-col items-center gap-0.5">
      {props.championId > 0 && meta ? (
        <img
          src={`ddicon://champion/${meta.id}.png`}
          alt={meta.name}
          title={meta.name}
          className={`${size} rounded border border-slate-700 ${props.dimmed === true ? 'opacity-40 grayscale' : ''}`}
        />
      ) : (
        <div
          className={`${size} flex items-center justify-center rounded border border-dashed border-slate-700 bg-slate-900 text-slate-600`}
          title={props.championId > 0 ? `campeón ${String(props.championId)}` : 'sin elegir'}
        >
          {props.championId > 0 ? props.championId : '?'}
        </div>
      )}
      {props.position !== undefined && props.position !== '' && (
        <span className="text-[9px] font-bold tracking-wide text-slate-500">
          {POSITION_LABEL[props.position] ?? props.position.toUpperCase()}
        </span>
      )}
    </div>
  )
}

/**
 * Champ select: ally/enemy portraits, bans, comp tips from visible picks and
 * the owner's baseline plan. Identities never appear (Riot policy §2) — only
 * champions.
 */
export default function ChampSelectPanel(props: {
  champSelect: ChampSelectState | null
  championMeta?: Record<number, ChampionMeta>
}): React.JSX.Element {
  const cs = props.champSelect
  const meta = props.championMeta ?? {}
  const [insights, setInsights] = useState<ChampSelectInsights | null>(null)

  const own = cs?.myTeam.find((member) => member.cellId === cs.localPlayerCellId)
  const ownKey = own === undefined ? 0 : own.championId || own.championPickIntent
  const ownMeta = ownKey > 0 ? meta[ownKey] : undefined

  useEffect(() => {
    if (!cs) return
    let cancelled = false
    void window.api.invoke('champselect:insights', cs).then((result) => {
      if (!cancelled) setInsights(result)
    })
    return () => {
      cancelled = true
    }
  }, [cs])

  if (!cs) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
        <span className="text-4xl" aria-hidden>
          🎯
        </span>
        <p className="text-sm font-medium text-slate-300">Selección de campeones en curso</p>
        <p className="max-w-xs text-xs text-slate-500">Esperando datos de la selección…</p>
      </div>
    )
  }

  return (
    <div className="card-in relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
      {/* Own pick splash as ambient banner */}
      {ownMeta && (
        <div className="absolute inset-0" aria-hidden>
          <img
            src={`ddicon://splash/${ownMeta.id}_0.jpg`}
            alt=""
            className="h-full w-full object-cover object-top opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/70 to-slate-900/40" />
        </div>
      )}

      <div className="relative flex flex-col gap-3 p-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-slate-100">
            Selección de campeones
            {cs.ownPosition !== null && cs.ownPosition !== '' && (
              <span className="ml-2 rounded bg-indigo-600/20 px-2 py-0.5 text-xs text-indigo-300">
                tu posición: {POSITION_LABEL[cs.ownPosition] ?? cs.ownPosition}
              </span>
            )}
          </p>
          {ownMeta && <p className="text-xs font-semibold text-amber-300">{ownMeta.name}</p>}
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-sky-300 uppercase">
              Tu equipo
            </p>
            <div className="flex gap-1.5">
              {cs.myTeam.map((member) => (
                <ChampionPortrait
                  key={member.cellId}
                  championId={member.championId || member.championPickIntent}
                  meta={meta}
                  position={member.position}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-rose-300 uppercase">
              Enemigos
            </p>
            <div className="flex gap-1.5">
              {cs.theirTeam.length > 0 ? (
                cs.theirTeam.map((member) => (
                  <ChampionPortrait key={member.cellId} championId={member.championId} meta={meta} />
                ))
              ) : (
                <p className="text-xs text-slate-500">Sin picks visibles todavía</p>
              )}
            </div>
          </div>
          {(cs.bans.mine.length > 0 || cs.bans.theirs.length > 0) && (
            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Baneos
              </p>
              <div className="flex gap-1">
                {[...cs.bans.mine, ...cs.bans.theirs]
                  .filter((id) => id > 0)
                  .map((id, index) => (
                    <ChampionPortrait
                      key={`${String(id)}-${String(index)}`}
                      championId={id}
                      meta={meta}
                      size="h-7 w-7"
                      dimmed
                    />
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {insights !== null && insights.picks.length > 0 && (
          <div className="rounded border border-indigo-500/30 bg-slate-950/60 p-2.5">
            <p className="mb-2 text-[10px] font-semibold tracking-widest text-indigo-300 uppercase">
              ¿Qué te pego? · tus partidas + Master+ + kit
            </p>
            <div className="flex flex-col gap-2">
              {insights.picks.map((pick, index) => (
                <div
                  key={pick.championId}
                  className={`flex items-start gap-2 rounded p-1.5 ${
                    index === 0 ? 'bg-indigo-500/10' : ''
                  }`}
                >
                  <img
                    src={`ddicon://champion/${pick.championId}.png`}
                    alt={pick.name}
                    className="h-10 w-10 rounded border border-slate-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-200">
                      {pick.name}{' '}
                      <span
                        className={`font-mono ${pick.winratePct >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}
                      >
                        {pick.winratePct.toFixed(0)}%
                      </span>{' '}
                      <span className="font-normal text-slate-500">
                        en {pick.games} partidas
                      </span>
                    </p>
                    <ul className="mt-0.5 space-y-px">
                      {/* reasons[0] repeats the WR shown above — list the rest. */}
                      {pick.reasons.slice(1, 5).map((reason, reasonIndex) => (
                        <li
                          key={reasonIndex}
                          className={`text-[11px] ${
                            reason.includes('Master+')
                              ? 'text-amber-300/90'
                              : reason.startsWith('ojo:') || reason.includes('te costará')
                                ? 'text-rose-300/90'
                                : 'text-slate-400'
                          }`}
                        >
                          · {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {insights !== null && insights.tips.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-950/60 p-2.5">
            <p className="mb-2 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
              Plan de compra contra esta comp
            </p>
            <ul className="space-y-1.5">
              {insights.tips.map((tip, index) => (
                <li key={index} className="alert-in text-xs leading-snug text-slate-300">
                  💡 {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
        </div>

        {insights?.ownPlan && (
          <div className="rounded border border-amber-400/20 bg-slate-950/60 p-2">
            <p className="mb-1 text-[11px] font-semibold text-amber-300">
              Tu plan con {ownMeta?.name ?? insights.ownPlan.championId} (de tus propias
              partidas)
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {insights.ownPlan.core.map((item, index) => (
                <span key={item.id} className="flex items-center gap-1 text-xs text-slate-300">
                  {index > 0 && <span className="text-slate-600">→</span>}
                  <img
                    src={`ddicon://item/${String(item.id)}.png`}
                    alt={item.name}
                    title={item.name}
                    className="h-7 w-7 rounded border border-slate-700"
                  />
                </span>
              ))}
              {insights.ownPlan.situational.length > 0 && (
                <>
                  <span className="mx-1 text-[10px] text-slate-500">situacionales:</span>
                  {insights.ownPlan.situational.map((item) => (
                    <img
                      key={item.id}
                      src={`ddicon://item/${String(item.id)}.png`}
                      alt={item.name}
                      title={item.name}
                      className="h-6 w-6 rounded border border-slate-800 opacity-80"
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {insights !== null && (insights.picks.length > 0 || insights.tips.length > 0) && (
          <CoachDraft insights={insights} />
        )}

        <p className="text-[11px] text-slate-600">
          Consejos derivados solo de los campeones visibles en pantalla.
        </p>
      </div>
    </div>
  )
}
