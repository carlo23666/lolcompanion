import type { AppDatabase } from '../db'
import { MatchRepo, MetaRepo, TimelineRepo } from '../db/repos'
import { SettingsRepo, SETTING_KEYS } from '../db/repos/settings'
import { broadcast, handleInvoke } from '../ipc'
import { RiotClient } from './client'
import { ingestHistory } from './ingest'
import { RiotRateLimiter } from './limiter'
import { MetaCrawler } from './metacrawler'
import { normalizeRiotId } from './riotid'

export { RiotClient, RiotApiError, PLATFORM_TO_REGIONAL } from './client'
export type { Result, RiotErrorKind } from './client'
export { RiotRateLimiter, APP_LIMITS, DEFAULT_METHOD_LIMITS } from './limiter'
export { ingestHistory, matchToRows } from './ingest'
export type { IngestProgress } from './ingest'

let ingestRunning = false
// One limiter per app lifetime so all Riot traffic shares the same buckets.
const limiter = new RiotRateLimiter()
// One meta crawler per app lifetime (background, lowest priority).
let metaCrawler: MetaCrawler | null = null

/**
 * Ready-to-use client + owner puuid, or null when the app is not configured
 * yet (no key, no riotId, or puuid not resolved).
 */
export function getRiotContext(db: AppDatabase): { client: RiotClient; puuid: string } | null {
  const settings = new SettingsRepo(db)
  const apiKey = process.env['RIOT_API_KEY']
  const puuid = settings.get(SETTING_KEYS.puuid)
  if (apiKey === undefined || apiKey === '' || puuid === null || puuid === '') return null
  const platform = settings.get(SETTING_KEYS.platform) ?? 'euw1'
  return { client: new RiotClient({ apiKey, platform, limiter }), puuid }
}

/** Owner puuid from settings (resolved at settings save or first sync). */
export function getOwnerPuuid(db: AppDatabase): string | null {
  const puuid = new SettingsRepo(db).get(SETTING_KEYS.puuid)
  return puuid === null || puuid === '' ? null : puuid
}

export function registerRiotIpc(db: AppDatabase): void {
  const settings = new SettingsRepo(db)

  handleInvoke('settings:get', () => ({
    riotId: settings.get(SETTING_KEYS.riotId),
    platform: settings.get(SETTING_KEYS.platform) ?? 'euw1',
    recordLive: settings.get(SETTING_KEYS.recordLive) === '1',
    soundsEnabled: settings.get(SETTING_KEYS.soundsEnabled) !== '0',
    overlayEnabled: settings.get(SETTING_KEYS.overlayEnabled) === '1',
    theme: settings.get(SETTING_KEYS.theme) ?? 'hextech'
  }))

  handleInvoke('settings:set', (update) => {
    const riotId = normalizeRiotId(update.riotId)
    const previousRiotId = settings.get(SETTING_KEYS.riotId)
    settings.set(SETTING_KEYS.riotId, riotId)
    settings.set(SETTING_KEYS.platform, update.platform)
    settings.set(SETTING_KEYS.recordLive, update.recordLive ? '1' : '0')
    settings.set(SETTING_KEYS.soundsEnabled, update.soundsEnabled ? '1' : '0')
    settings.set(SETTING_KEYS.overlayEnabled, update.overlayEnabled ? '1' : '0')
    settings.set(SETTING_KEYS.theme, update.theme)
    if (previousRiotId !== riotId) {
      // riotId changed → cached puuid no longer valid; re-resolve in the
      // background so post-game auto-ingest works without a full sync.
      settings.set(SETTING_KEYS.puuid, '')
      const apiKey = process.env['RIOT_API_KEY']
      if (apiKey !== undefined && apiKey !== '' && riotId.includes('#')) {
        const [gameName = '', tagLine = ''] = riotId.split('#', 2)
        const client = new RiotClient({
          apiKey,
          platform: update.platform,
          limiter
        })
        void client.accountByRiotId(gameName, tagLine).then((account) => {
          if (account.ok) settings.set(SETTING_KEYS.puuid, account.value.puuid)
        })
      }
    }
    limiter.reset()
    return { saved: true as const }
  })

  handleInvoke('ingest:start', async () => {
    if (ingestRunning) return { started: false as const, error: 'Sincronización ya en curso' }

    const apiKey = process.env['RIOT_API_KEY']
    if (apiKey === undefined || apiKey === '') {
      return {
        started: false as const,
        error: 'Falta RIOT_API_KEY en .env (ver .env.example)'
      }
    }
    // Normalize on read too: values saved before this fix may still carry
    // the invisible characters.
    const riotId = normalizeRiotId(settings.get(SETTING_KEYS.riotId) ?? '')
    if (riotId === '' || !riotId.includes('#')) {
      return { started: false as const, error: 'Configura tu Riot ID (nombre#TAG) primero' }
    }
    const platform = settings.get(SETTING_KEYS.platform) ?? 'euw1'
    const client = new RiotClient({ apiKey, platform, limiter })

    const [gameName = '', tagLine = ''] = riotId.split('#', 2)
    let puuid = settings.get(SETTING_KEYS.puuid)
    if (puuid === null || puuid === '') {
      const account = await client.accountByRiotId(gameName, tagLine)
      if (!account.ok) {
        return { started: false as const, error: `Cuenta no encontrada: ${account.error.message}` }
      }
      puuid = account.value.puuid
      settings.set(SETTING_KEYS.puuid, puuid)
    }

    ingestRunning = true
    const resolvedPuuid = puuid
    void ingestHistory({
      client,
      matchRepo: new MatchRepo(db),
      timelineRepo: new TimelineRepo(db),
      puuid: resolvedPuuid,
      maxMatches: 200,
      onProgress: (progress) => broadcast('ingest:progress', progress)
    })
      .catch((error: unknown) => {
        broadcast('ingest:progress', {
          fetched: 0,
          stored: 0,
          skipped: 0,
          failed: 0,
          done: false,
          error: error instanceof Error ? error.message : String(error)
        })
      })
      .finally(() => {
        ingestRunning = false
      })

    return { started: true as const }
  })

  const metaRepo = new MetaRepo(db)
  handleInvoke('meta:status', () => ({
    ...(metaCrawler?.status() ?? {
      running: false,
      processed: 0,
      stored: 0,
      seedsDone: 0,
      seedsTotal: 0,
      error: null
    }),
    patches: metaRepo.status()
  }))

  handleInvoke('meta:crawl:start', () => {
    const apiKey = process.env['RIOT_API_KEY']
    if (apiKey === undefined || apiKey === '') {
      return { started: false, error: 'Falta RIOT_API_KEY en .env (ver .env.example)' }
    }
    const platform = settings.get(SETTING_KEYS.platform) ?? 'euw1'
    metaCrawler ??= new MetaCrawler({
      client: new RiotClient({ apiKey, platform, limiter }),
      repo: metaRepo,
      onProgress: (status) => broadcast('meta:progress', status),
      log: (message) => console.log(message)
    })
    return metaCrawler.start()
  })

  handleInvoke('meta:crawl:stop', () => {
    metaCrawler?.stop()
    return { stopped: true as const }
  })
}
