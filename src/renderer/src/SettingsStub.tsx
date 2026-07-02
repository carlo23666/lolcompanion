import { useEffect, useState } from 'react'
import type { IngestProgressPayload } from '@shared/ipc'

const PLATFORMS = ['euw1', 'eun1', 'na1', 'kr', 'br1', 'la1', 'la2', 'jp1', 'tr1', 'ru', 'oc1']

/** Settings stub (WP-004): riotId + region + sync with progress. WP-008 restyles. */
export default function SettingsStub(): React.JSX.Element {
  const [riotId, setRiotId] = useState('')
  const [platform, setPlatform] = useState('euw1')
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<IngestProgressPayload | null>(null)

  useEffect(() => {
    void window.api.invoke('settings:get').then((settings) => {
      setRiotId(settings.riotId ?? '')
      setPlatform(settings.platform)
    })
    return window.api.on('ingest:progress', setProgress)
  }, [])

  const save = async (): Promise<void> => {
    await window.api.invoke('settings:set', { riotId, platform })
    setStatus('Guardado')
  }

  const sync = async (): Promise<void> => {
    setStatus(null)
    setProgress(null)
    const result = await window.api.invoke('ingest:start')
    if (!result.started) setStatus(result.error ?? 'No se pudo iniciar la sincronización')
  }

  return (
    <section className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">Ajustes (provisional)</h2>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-slate-400">
          Riot ID (nombre#TAG)
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
            value={riotId}
            onChange={(event) => setRiotId(event.target.value)}
            placeholder="Ejemplo#EUW"
          />
        </label>
        <label className="text-xs text-slate-400">
          Región
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
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
        <div className="mt-1 flex gap-2">
          <button
            className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
            onClick={() => void save()}
          >
            Guardar
          </button>
          <button
            className="rounded bg-indigo-700 px-3 py-1 text-sm hover:bg-indigo-600"
            onClick={() => void sync()}
          >
            Sincronizar historial
          </button>
        </div>
        {status !== null && <p className="text-xs text-amber-400">{status}</p>}
        {progress !== null && (
          <div className="mt-1">
            <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: progress.done ? '100%' : `${String(Math.min(progress.stored / 2, 100))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {progress.error !== undefined
                ? `Error: ${progress.error}`
                : progress.done
                  ? `Completado: ${String(progress.stored)} partidas (${String(progress.skipped)} ya guardadas)`
                  : `Descargando… ${String(progress.stored)} guardadas, ${String(progress.skipped)} omitidas`}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
