import { useEffect, useRef, useState } from 'react'
import type { ChampionMeta } from '@shared/champselect'
import type { SessionPhase } from '@shared/session'
import { normalizeTheme } from '@shared/themes'
import Shell, { type ViewId } from './components/Shell'
import LiveView from './components/LiveView'
import HistoryView from './components/HistoryView'
import SettingsView from './components/SettingsView'
import { useIpcEvent, useLiveInsights } from './hooks'
import { configureSounds, playAlert, playObjective, playRecommendation } from './sounds'

/** Applies the selected identity; components restyle via CSS variables and
 * mascots listen for the change event to swap sprites live. */
export function applyTheme(theme: string): void {
  const normalized = normalizeTheme(theme)
  document.documentElement.dataset['theme'] = normalized
  window.dispatchEvent(new CustomEvent('app-theme', { detail: normalized }))
}

export default function App(): React.JSX.Element {
  const [view, setView] = useState<ViewId>('live')
  const [phase, setPhase] = useState<SessionPhase>('idle')
  const [championMeta, setChampionMeta] = useState<Record<number, ChampionMeta>>({})
  const gameState = useIpcEvent('gamestate:update')
  const liveState = useIpcEvent('live:state')
  const champSelect = useIpcEvent('session:champselect')
  const recommendations = useIpcEvent('gamestate:recommendations')
  const insights = useLiveInsights()
  const [mascotReactKey, setMascotReactKey] = useState(0)
  const lastTopRef = useRef('')
  const lastAlertRef = useRef(0)

  useEffect(() => {
    void window.api.invoke('session:get').then(setPhase)
    void window.api.invoke('settings:get').then((settings) => {
      configureSounds({
        enabled: settings.soundsEnabled,
        ...(typeof settings.soundVolume === 'number' ? { volume: settings.soundVolume } : {}),
        ...(settings.soundCategories != null ? { categories: settings.soundCategories } : {})
      })
      applyTheme(settings.theme)
    })
    // Offline with no cached patch this rejects; the UI then falls back to
    // showing numeric champion ids.
    window.api.invoke('staticdata:championMeta').then(setChampionMeta, () => undefined)
    return window.api.on('session:phase', setPhase)
  }, [])

  // Gold chime when the top recommendation changes.
  useEffect(() => {
    const top = recommendations?.recommendations[0]
    if (!top) return
    const key = `${String(top.itemId ?? top.category)}:${top.action}`
    if (lastTopRef.current !== '' && key !== lastTopRef.current) playRecommendation()
    lastTopRef.current = key
  }, [recommendations])

  // Blip + mascot reaction when a new spike/objective alert lands.
  useEffect(() => {
    const newest = insights.alerts[0]
    if (!newest || newest.id === lastAlertRef.current) return
    lastAlertRef.current = newest.id
    if (newest.kind === 'spike' || newest.kind === 'objective' || newest.kind === 'coach') {
      // Coach tips stay silent — Hexi reacting is enough mid-game.
      if (newest.kind === 'objective') playObjective()
      else if (newest.kind === 'spike') playAlert()
      setMascotReactKey((key) => key + 1)
    }
  }, [insights.alerts])

  return (
    <Shell active={view} onSelect={setView} phase={phase} mascotReactKey={mascotReactKey}>
      {view === 'live' && (
        <LiveView
          phase={phase}
          liveState={liveState}
          gameState={gameState}
          champSelect={champSelect}
          recommendations={recommendations}
          championMeta={championMeta}
          insights={insights}
          onOpenSettings={() => setView('settings')}
          onOpenHistory={() => setView('history')}
        />
      )}
      {view === 'history' && <HistoryView />}
      {view === 'settings' && <SettingsView />}
    </Shell>
  )
}
