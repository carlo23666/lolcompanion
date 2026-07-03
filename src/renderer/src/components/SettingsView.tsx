import { useEffect, useState } from 'react'
import type { IngestProgressPayload } from '@shared/ipc'
import { applyTheme } from '../App'
import { setSoundsEnabled } from '../sounds'

const PLATFORMS = ['euw1', 'eun1', 'na1', 'kr', 'br1', 'la1', 'la2', 'jp1', 'tr1', 'ru', 'oc1']

const THEMES: { id: string; label: string; hint: string }[] = [
  { id: 'hextech', label: 'Hextech', hint: 'azul marino + dorado (clásico)' },
  { id: 'void', label: 'Vacío', hint: 'púrpura profundo + magenta' },
  { id: 'noche', label: 'Noche', hint: 'grafito neutro + azul (minimal)' }
]

const REPLAY_SPEEDS: { label: string; intervalMs: number }[] = [
  { label: 'x4', intervalMs: 500 },
  { label: 'x8', intervalMs: 250 },
  { label: 'x20', intervalMs: 100 }
]

/**
 * Dev-only simulation panel: replay recorded games through the real pipeline
 * and fake a champ select, to test the whole app without playing. Hidden in
 * the packaged app (the replay list comes back empty there).
 */
function DevToolsSection(): React.JSX.Element | null {
  const [replays, setReplays] = useState<{ id: string; label: string }[]>([])
  const [selected, setSelected] = useState('')
  const [intervalMs, setIntervalMs] = useState(500)
  const [running, setRunning] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [champSelectOn, setChampSelectOn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.invoke('dev:replays').then((list) => {
      // Defensive: packaged app returns [], test stubs may return junk.
      if (!Array.isArray(list)) return
      setReplays(list)
      setSelected((current) => (current === '' ? (list[0]?.id ?? '') : current))
    }, () => undefined)
  }, [])

  // Progress poll while a replay runs.
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => {
      void window.api.invoke('dev:replay:status').then((status) => {
        setProgressPct(status.progressPct)
        if (!status.running) setRunning(false)
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [running])

  if (replays.length === 0) return null

  const startReplay = async (): Promise<void> => {
    setError(null)
    const result = await window.api.invoke('dev:replay:start', selected, intervalMs)
    if (result.started) setRunning(true)
    else setError(result.error ?? 'no se pudo iniciar')
  }

  const stopReplay = async (): Promise<void> => {
    await window.api.invoke('dev:replay:stop')
    setRunning(false)
  }

  const toggleChampSelect = async (): Promise<void> => {
    if (champSelectOn) {
      await window.api.invoke('dev:champselect:stop')
      setChampSelectOn(false)
    } else {
      const result = await window.api.invoke('dev:champselect:start')
      setChampSelectOn(result.started)
    }
  }

  return (
    <section className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-300">
        Herramientas de prueba <span className="text-[10px] text-slate-500">(solo desarrollo)</span>
      </h2>
      <p className="mb-3 text-[11px] text-slate-500">
        Reproduce una partida grabada por todo el pipeline real (Live, motor, overlay, alertas)
        sin abrir LoL, o simula una selección de campeones.
      </p>
      <div className="flex flex-col gap-2 text-xs">
        <label className="text-slate-400">
          Partida grabada
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            disabled={running}
          >
            {replays.map((replay) => (
              <option key={replay.id} value={replay.id}>
                {replay.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Velocidad</span>
          {REPLAY_SPEEDS.map((speed) => (
            <button
              key={speed.intervalMs}
              disabled={running}
              onClick={() => setIntervalMs(speed.intervalMs)}
              aria-pressed={intervalMs === speed.intervalMs}
              className={`rounded border px-2 py-1 ${
                intervalMs === speed.intervalMs
                  ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                  : 'border-slate-700 bg-slate-800 text-slate-300'
              }`}
            >
              {speed.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <>
              <button
                className="rounded bg-rose-700 px-3 py-1.5 hover:bg-rose-600"
                onClick={() => void stopReplay()}
              >
                Detener replay
              </button>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-800">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${String(progressPct)}%` }}
                />
              </div>
            </>
          ) : (
            <button
              className="rounded bg-indigo-700 px-3 py-1.5 hover:bg-indigo-600"
              onClick={() => void startReplay()}
              disabled={selected === ''}
            >
              ▶ Reproducir en la vista Live
            </button>
          )}
          <button
            className={`rounded px-3 py-1.5 ${
              champSelectOn
                ? 'bg-rose-700 hover:bg-rose-600'
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
            onClick={() => void toggleChampSelect()}
          >
            {champSelectOn ? 'Terminar champ select' : 'Simular champ select'}
          </button>
        </div>
        {error !== null && <p className="text-rose-400">{error}</p>}
      </div>
    </section>
  )
}

export default function SettingsView(): React.JSX.Element {
  const [riotId, setRiotId] = useState('')
  const [platform, setPlatform] = useState('euw1')
  const [recordLive, setRecordLive] = useState(false)
  const [sounds, setSounds] = useState(true)
  const [overlay, setOverlay] = useState(false)
  const [theme, setTheme] = useState('hextech')
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<IngestProgressPayload | null>(null)

  useEffect(() => {
    void window.api.invoke('settings:get').then((settings) => {
      setRiotId(settings.riotId ?? '')
      setPlatform(settings.platform)
      setRecordLive(settings.recordLive)
      setSounds(settings.soundsEnabled)
      setOverlay(settings.overlayEnabled)
      setTheme(settings.theme)
    })
    return window.api.on('ingest:progress', setProgress)
  }, [])

  const previewTheme = (id: string): void => {
    setTheme(id)
    applyTheme(id) // instant preview; persisted on Guardar
  }

  const save = async (): Promise<void> => {
    await window.api.invoke('settings:set', {
      riotId,
      platform,
      recordLive,
      soundsEnabled: sounds,
      overlayEnabled: overlay,
      theme
    })
    setSoundsEnabled(sounds)
    setStatus('Ajustes guardados')
  }

  const sync = async (): Promise<void> => {
    setStatus(null)
    setProgress(null)
    const result = await window.api.invoke('ingest:start')
    if (!result.started) setStatus(result.error ?? 'No se pudo iniciar la sincronización')
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <h1 className="text-lg font-bold">Ajustes</h1>

      <section className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Cuenta</h2>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-slate-400">
            Riot ID (nombre#TAG)
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              value={riotId}
              onChange={(event) => setRiotId(event.target.value)}
              placeholder="Ejemplo#EUW"
            />
          </label>
          <label className="text-xs text-slate-400">
            Región
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={recordLive}
              onChange={(event) => setRecordLive(event.target.checked)}
            />
            Grabar partidas en vivo como fixtures (solo desarrollo)
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={sounds}
              onChange={(event) => setSounds(event.target.checked)}
            />
            Sonidos (aviso de recomendación y spikes enemigos)
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={overlay}
              onChange={(event) => setOverlay(event.target.checked)}
            />
            Overlay in-game con Hexi (experimental — requiere LoL en ventana o sin bordes; se
            activa al entrar en partida)
          </label>
          <fieldset className="text-xs text-slate-400">
            <legend className="mb-1">Tema</legend>
            <div className="flex gap-2">
              {THEMES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  title={option.hint}
                  onClick={() => previewTheme(option.id)}
                  aria-pressed={theme === option.id}
                  className={`rounded border px-3 py-1.5 transition-colors ${
                    theme === option.id
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              Se aplica al instante; pulsa Guardar para conservarlo.
            </p>
          </fieldset>
          <div className="flex gap-2">
            <button
              className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
              onClick={() => void save()}
            >
              Guardar
            </button>
            <button
              className="rounded bg-indigo-700 px-3 py-1.5 text-sm hover:bg-indigo-600"
              onClick={() => void sync()}
            >
              Sincronizar historial
            </button>
          </div>
          {status !== null && <p className="text-xs text-amber-400">{status}</p>}
        </div>
      </section>

      <DevToolsSection />

      {progress !== null && (
        <section className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Sincronización</h2>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{
                width: progress.done ? '100%' : `${String(Math.min(progress.stored / 2, 100))}%`
              }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {progress.error !== undefined
              ? `Error: ${progress.error}`
              : progress.done
                ? `Completado: ${String(progress.stored)} partidas nuevas (${String(progress.skipped)} ya guardadas)`
                : `Descargando… ${String(progress.stored)} guardadas, ${String(progress.skipped)} omitidas`}
          </p>
        </section>
      )}
    </div>
  )
}
