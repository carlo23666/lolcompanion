import { useEffect, useState } from 'react'
import type { IngestProgressPayload, MetaStatusPayload } from '@shared/ipc'
import { DEFAULT_THEME, THEMES } from '@shared/themes'
import {
  normalizeOverlayScale,
  OVERLAY_SCALE_DEFAULT,
  OVERLAY_SCALE_MAX,
  OVERLAY_SCALE_MIN
} from '@shared/overlay'
import { DEFAULT_LOCALE, LOCALES, LOCALE_LABELS, normalizeLocale, type Locale } from '@shared/i18n'
import { applyTheme } from '../appearance'
import { applyLocale, useT } from '../i18n'
import { configureSounds, playPreview, type SoundCategories } from '../sounds'
import DevScenario from './DevScenario'

const PLATFORMS = ['euw1', 'eun1', 'na1', 'kr', 'br1', 'la1', 'la2', 'jp1', 'tr1', 'ru', 'oc1']

const REPLAY_SPEEDS: { label: string; intervalMs: number }[] = [
  { label: 'x4', intervalMs: 500 },
  { label: 'x8', intervalMs: 250 },
  { label: 'x20', intervalMs: 100 }
]

/**
 * Master+ meta aggregation: start/stop the background crawler and show what
 * has been collected. Data feeds pick suggestions and the report card.
 */
function MetaSection(): React.JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<MetaStatusPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = (): void => {
    void window.api.invoke('meta:status').then((payload) => {
      if (typeof payload === 'object' && Array.isArray(payload.patches)) setStatus(payload)
    }, () => undefined)
  }

  useEffect(() => {
    refresh()
    return window.api.on('meta:progress', refresh)
  }, [])

  const start = async (): Promise<void> => {
    setError(null)
    const result = await window.api.invoke('meta:crawl:start')
    if (!result.started) setError(result.error ?? t('set.meta.startError'))
    refresh()
  }

  const stop = async (): Promise<void> => {
    await window.api.invoke('meta:crawl:stop')
    refresh()
  }

  const running = status?.running === true
  const totalMatches = status?.patches.reduce((sum, patch) => sum + patch.matches, 0) ?? 0
  const currentPatchMatches =
    status?.livePatch != null
      ? (status.patches.find((entry) => entry.patch === status.livePatch)?.matches ?? 0)
      : 0
  const seedDays =
    status?.seed != null
      ? Math.max(
          0,
          Math.floor((Date.now() - new Date(status.seed.exportedAt).getTime()) / 86_400_000)
        )
      : 0

  return (
    <section className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-300">{t('set.meta.title')}</h2>
      <p className="mb-3 text-[11px] text-slate-500">{t('set.meta.desc')}</p>
      <div className="flex flex-col gap-2 text-xs">
        {status !== null && (
          <p className="text-slate-500">
            {status.seed === null
              ? t('set.meta.noBase')
              : seedDays === 0
                ? t('set.meta.baseToday', { patch: status.seed.patch })
                : t('set.meta.base', { patch: status.seed.patch, days: String(seedDays) })}
          </p>
        )}
        {totalMatches > 0 && status !== null && (
          <p className="text-slate-400">
            📦 {t('set.meta.aggregated', { n: String(totalMatches) })}
            {status.patches.length > 0 && (
              <span className="text-slate-500">
                {' '}
                (
                {status.patches
                  .map((entry) =>
                    t('set.meta.patchEntry', { patch: entry.patch, n: String(entry.matches) })
                  )
                  .join(' · ')}
                )
              </span>
            )}
          </p>
        )}
        {status?.livePatch != null && (
          <p className="text-slate-400">
            🎯{' '}
            {t('set.meta.currentPatch', {
              patch: status.livePatch,
              n: String(currentPatchMatches)
            })}
          </p>
        )}
        {running && status !== null && (
          <p className="text-indigo-300">
            ⛏{' '}
            {t('set.meta.crawling', {
              stored: String(status.stored),
              done: String(status.seedsDone),
              total: String(status.seedsTotal),
              rate: String(status.gamesPerHour)
            })}
          </p>
        )}
        <div className="flex gap-2">
          {running ? (
            <button
              className="rounded bg-rose-700 px-3 py-1.5 hover:bg-rose-600"
              onClick={() => void stop()}
            >
              {t('set.meta.stop')}
            </button>
          ) : (
            <button
              className="rounded bg-indigo-700 px-3 py-1.5 hover:bg-indigo-600"
              onClick={() => void start()}
            >
              ⛏ {t('set.meta.start')}
            </button>
          )}
        </div>
        {(error !== null || status?.error != null) && (
          <p className="text-rose-400">{error ?? status?.error}</p>
        )}
      </div>
    </section>
  )
}

/**
 * Local-AI coach (Ollama): free local models narrate the post-game report.
 * Purely optional — the app never requires it.
 */
function CoachSection(): React.JSX.Element {
  const t = useT()
  const [enabled, setEnabled] = useState(false)
  const [liveEnabled, setLiveEnabled] = useState(false)
  const [model, setModel] = useState('gemma3:4b')
  const [available, setAvailable] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [saved, setSaved] = useState(false)

  const refresh = (keepSelection = false): void => {
    void window.api.invoke('coach:status').then((status) => {
      setEnabled(status.enabled === true)
      setLiveEnabled(status.liveEnabled === true)
      if (!keepSelection && typeof status.model === 'string') setModel(status.model)
      setAvailable(status.available === true)
      if (Array.isArray(status.models)) setModels(status.models)
    }, () => undefined)
  }

  useEffect(() => {
    refresh()
  }, [])

  const save = async (): Promise<void> => {
    await window.api.invoke('coach:configure', { enabled, model, liveEnabled })
    setSaved(true)
    refresh(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-300">{t('set.coach.title')}</h2>
      <p className="mb-3 text-[11px] text-slate-500">{t('set.coach.desc')}</p>
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2">
          {available ? (
            <p className="text-emerald-400">✓ {t('set.coach.detected', { n: String(models.length) })}</p>
          ) : (
            <p className="text-slate-500">
              {t('set.coach.notDetected')}{' '}
              <span className="text-indigo-300">ollama.com</span> {t('set.coach.andRun')}{' '}
              <code className="rounded bg-slate-800 px-1">ollama pull gemma3:4b</code>
            </p>
          )}
          <button
            type="button"
            title={t('set.coach.recheck')}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 hover:border-slate-500"
            onClick={() => refresh(true)}
          >
            ↻
          </button>
        </div>
        <label className="flex items-center gap-2 text-slate-400">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          {t('set.coach.enable')}
        </label>
        <label className="flex items-center gap-2 text-slate-400">
          <input
            type="checkbox"
            checked={liveEnabled}
            disabled={!enabled}
            onChange={(event) => setLiveEnabled(event.target.checked)}
          />
          {t('set.coach.live')}
        </label>
        <label className="text-slate-400">
          {t('set.coach.model')}
          {models.length > 0 ? (
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {!models.includes(model) && (
                <option value={model}>{t('set.coach.notInstalled', { model })}</option>
              )}
              {models.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-slate-100"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          )}
        </label>
        <div className="flex items-center gap-2">
          <button
            className="rounded bg-slate-700 px-3 py-1.5 hover:bg-slate-600"
            onClick={() => void save()}
          >
            {t('set.save')}
          </button>
          {saved && <span className="text-amber-400">{t('set.savedShort')}</span>}
        </div>
      </div>
    </section>
  )
}

/**
 * Dev-only simulation panel: replay recorded games through the real pipeline
 * and fake a champ select, to test the whole app without playing. Hidden in
 * the packaged app (the replay list comes back empty there).
 */
function DevToolsSection(): React.JSX.Element | null {
  const [enabled, setEnabled] = useState(false)
  const [replays, setReplays] = useState<{ id: string; label: string }[]>([])
  const [selected, setSelected] = useState('')
  const [intervalMs, setIntervalMs] = useState(500)
  const [running, setRunning] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [champSelectOn, setChampSelectOn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.invoke('dev:enabled').then((flag) => {
      // Defensive: test stubs may return junk for unknown channels.
      setEnabled(flag === true)
    }, () => undefined)
    void window.api.invoke('dev:replays').then((list) => {
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

  if (!enabled) return null

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
    <section className="max-w-2xl rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-300">
        Herramientas de prueba <span className="text-[10px] text-slate-500">(solo desarrollo)</span>
      </h2>
      <p className="mb-3 text-[11px] text-slate-500">
        Reproduce una partida grabada, fuerza una situación de juego hecha a medida o simula un
        draft — todo pasa por el pipeline real (Live, motor, overlay, alertas) sin abrir LoL.
      </p>
      <div className="mb-3 flex flex-col gap-2 text-xs">
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

      <DevScenario />
    </section>
  )
}

export default function SettingsView(): React.JSX.Element {
  const [riotId, setRiotId] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [apiKeySet, setApiKeySet] = useState(false)
  const [platform, setPlatform] = useState('euw1')
  const [recordLive, setRecordLive] = useState(false)
  const [sounds, setSounds] = useState(true)
  const [soundVolume, setSoundVolume] = useState(60)
  const [soundCategories, setSoundCategories] = useState<SoundCategories>({
    recommendation: true,
    spike: true,
    objective: true
  })
  const [overlay, setOverlay] = useState(false)
  const [overlayScale, setOverlayScale] = useState(OVERLAY_SCALE_DEFAULT)
  const [theme, setTheme] = useState(DEFAULT_THEME)
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  const [status, setStatus] = useState<string | null>(null)
  const [progress, setProgress] = useState<IngestProgressPayload | null>(null)
  const t = useT()

  useEffect(() => {
    void window.api.invoke('settings:get').then((settings) => {
      setRiotId(settings.riotId ?? '')
      setApiKeySet(settings.apiKeySet === true)
      setPlatform(settings.platform)
      setRecordLive(settings.recordLive)
      setSounds(settings.soundsEnabled)
      if (typeof settings.soundVolume === 'number') setSoundVolume(settings.soundVolume)
      if (settings.soundCategories != null) setSoundCategories(settings.soundCategories)
      setOverlay(settings.overlayEnabled)
      setOverlayScale(normalizeOverlayScale(settings.overlayScale))
      setTheme(settings.theme)
      setLocale(normalizeLocale(settings.locale))
    })
    return window.api.on('ingest:progress', setProgress)
  }, [])

  const previewTheme = (id: string): void => {
    setTheme(id)
    applyTheme(id) // instant preview; persisted on Guardar
    void window.api.invoke('overlay:configure', { theme: id })
  }

  const previewOverlayScale = (value: number): void => {
    const normalized = normalizeOverlayScale(value)
    setOverlayScale(normalized)
    void window.api.invoke('overlay:configure', { scale: normalized })
  }

  const changeLocale = (next: Locale): void => {
    setLocale(next)
    applyLocale(next) // instant; persisted on save
  }

  const save = async (): Promise<void> => {
    const trimmedKey = apiKeyInput.trim()
    await window.api.invoke('settings:set', {
      riotId,
      platform,
      recordLive,
      soundsEnabled: sounds,
      soundVolume,
      soundCategories,
      overlayEnabled: overlay,
      overlayScale,
      theme,
      locale,
      // Only send a key when the user typed one — undefined keeps the stored one.
      ...(trimmedKey === '' ? {} : { apiKey: trimmedKey })
    })
    if (trimmedKey !== '') {
      setApiKeySet(true)
      setApiKeyInput('')
    }
    configureSounds({ enabled: sounds, volume: soundVolume, categories: soundCategories })
    setStatus(t('set.settingsSaved'))
  }

  const sync = async (): Promise<void> => {
    setStatus(null)
    setProgress(null)
    const result = await window.api.invoke('ingest:start')
    if (!result.started) setStatus(result.error ?? t('set.syncError'))
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4 p-4">
      <h1 className="text-lg font-bold">{t('nav.settings')}</h1>

      <section className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">{t('set.account')}</h2>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-slate-400">
            {t('set.riotId')}
            <input
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              value={riotId}
              onChange={(event) => setRiotId(event.target.value)}
              placeholder={t('set.riotIdPlaceholder')}
            />
          </label>
          <label className="text-xs text-slate-400">
            {t('set.apiKey')}{' '}
            {apiKeySet && <span className="text-emerald-400">✓ {t('set.saved')}</span>}
            <input
              type="password"
              autoComplete="off"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder={apiKeySet ? t('set.apiKeyPlaceholderSet') : 'RGAPI-…'}
            />
            <span className="mt-1 block text-[11px] text-slate-600">{t('set.apiKeyHint')}</span>
          </label>
          <label className="text-xs text-slate-400">
            {t('set.region')}
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
            {t('set.recordLive')}
          </label>
          <fieldset className="rounded border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-400">
            <legend className="px-1">{t('set.sounds')}</legend>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sounds}
                onChange={(event) => setSounds(event.target.checked)}
              />
              {t('set.soundsEnable')}
            </label>
            <div className={sounds ? 'mt-2 flex flex-col gap-1.5' : 'mt-2 flex flex-col gap-1.5 opacity-40'}>
              <label className="flex items-center gap-2">
                {t('set.volume')}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={soundVolume}
                  disabled={!sounds}
                  onChange={(event) => setSoundVolume(Number(event.target.value))}
                  className="flex-1 accent-amber-400"
                />
                <span className="w-8 text-right font-mono">{soundVolume}</span>
              </label>
              {(
                [
                  { key: 'recommendation', label: t('set.sound.recommendation') },
                  { key: 'spike', label: t('set.sound.spike') },
                  { key: 'objective', label: t('set.sound.objective') }
                ] as const
              ).map((category) => (
                <label key={category.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={!sounds}
                    checked={soundCategories[category.key]}
                    onChange={(event) =>
                      setSoundCategories((current) => ({
                        ...current,
                        [category.key]: event.target.checked
                      }))
                    }
                  />
                  {category.label}
                </label>
              ))}
              <button
                type="button"
                disabled={!sounds}
                className="self-start rounded border border-slate-700 bg-slate-800 px-2 py-1 hover:border-slate-500"
                onClick={() => {
                  configureSounds({
                    enabled: sounds,
                    volume: soundVolume,
                    categories: soundCategories
                  })
                  playPreview()
                }}
              >
                🔊 {t('set.soundTest')}
              </button>
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={overlay}
              onChange={(event) => setOverlay(event.target.checked)}
            />
            {t('set.overlay')}
          </label>
          <fieldset
            className={`rounded border border-slate-800 bg-slate-950/40 p-2 text-xs text-slate-400 ${overlay ? '' : 'opacity-45'}`}
            disabled={!overlay}
          >
            <legend className="px-1">{t('set.overlayLayout')}</legend>
            <label className="flex items-center gap-2">
              {t('set.overlayScale')}
              <input
                type="range"
                min={OVERLAY_SCALE_MIN}
                max={OVERLAY_SCALE_MAX}
                step={5}
                value={overlayScale}
                onChange={(event) => previewOverlayScale(Number(event.target.value))}
                className="flex-1 accent-amber-400"
              />
              <span className="w-10 text-right font-mono">{overlayScale}%</span>
            </label>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-600">{t('set.overlayMoveHint')}</p>
              <button
                type="button"
                className="shrink-0 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-300 hover:border-slate-500"
                onClick={() => {
                  void window.api.invoke('overlay:configure', { resetPosition: true }).then(() => {
                    setStatus(t('set.overlayPositionReset'))
                  })
                }}
              >
                {t('set.overlayReset')}
              </button>
            </div>
          </fieldset>
          <fieldset className="text-xs text-slate-400">
            <legend className="mb-1">{t('settings.language')}</legend>
            <div className="flex gap-2">
              {LOCALES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => changeLocale(option)}
                  aria-pressed={locale === option}
                  className={`rounded border px-3 py-1.5 transition-colors ${
                    locale === option
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {LOCALE_LABELS[option]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-600">{t('settings.language.hint')}</p>
          </fieldset>
          <fieldset className="text-xs text-slate-400">
            <legend className="mb-1">{t('set.theme')}</legend>
            <div className="flex gap-2">
              {THEMES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  title={t(option.hintKey)}
                  onClick={() => previewTheme(option.id)}
                  aria-pressed={theme === option.id}
                  className={`rounded border px-3 py-1.5 transition-colors ${
                    theme === option.id
                      ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-600">{t('set.applyHint')}</p>
          </fieldset>
          <div className="flex gap-2">
            <button
              className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
              onClick={() => void save()}
            >
              {t('set.save')}
            </button>
            <button className="btn-glow rounded-md px-3 py-1.5 text-sm" onClick={() => void sync()}>
              {t('set.saveHistory')}
            </button>
          </div>
          {status !== null && <p className="text-xs text-amber-400">{status}</p>}
        </div>
      </section>

      <MetaSection />

      <CoachSection />

      <DevToolsSection />

      {progress !== null && (
        <section className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">{t('set.sync.title')}</h2>
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
              ? t('set.sync.error', { error: progress.error })
              : progress.done
                ? t('set.sync.done', {
                    stored: String(progress.stored),
                    skipped: String(progress.skipped)
                  })
                : t('set.sync.downloading', {
                    stored: String(progress.stored),
                    skipped: String(progress.skipped)
                  })}
          </p>
        </section>
      )}
    </div>
  )
}
