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
