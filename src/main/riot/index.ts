import { safeStorage } from 'electron'
import type { AppDatabase } from '../db'
import { MatchRepo, MetaRepo, TimelineRepo } from '../db/repos'
import { SettingsRepo, SETTING_KEYS } from '../db/repos/settings'
import { broadcast, handleInvoke } from '../ipc'
import { createSafeStorageCodec, hasApiKey, resolveApiKey, storeApiKey } from './apikey'
import { RiotClient } from './client'
import { ingestHistory } from './ingest'
import { RiotRateLimiter } from './limiter'
import { MetaCrawler } from './metacrawler'
import { normalizeRiotId } from './riotid'
import { getStaticDataManager } from '../staticdata'
import { isFinishedBuildItem } from '../staticdata/itemgraph'
import { normalizeTheme } from '@shared/themes'
import { createTranslator, normalizeLocale, type Locale, type Translator } from '@shared/i18n'

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
// safeStorage is ready once the app is (all callers run post app.whenReady).
const keyCodec = createSafeStorageCodec(safeStorage)

/**
 * Ready-to-use client + owner puuid, or null when the app is not configured
 * yet (no key, no riotId, or puuid not resolved).
 */
export function getRiotContext(db: AppDatabase): { client: RiotClient; puuid: string } | null {
  const settings = new SettingsRepo(db)
  const apiKey = resolveApiKey(settings, keyCodec)
  const puuid = settings.get(SETTING_KEYS.puuid)
  if (apiKey === null || puuid === null || puuid === '') return null
  const platform = settings.get(SETTING_KEYS.platform) ?? 'euw1'
  return { client: new RiotClient({ apiKey, platform, limiter }), puuid }
}

/** Owner puuid from settings (resolved at settings save or first sync). */
export function getOwnerPuuid(db: AppDatabase): string | null {
  const puuid = new SettingsRepo(db).get(SETTING_KEYS.puuid)
  return puuid === null || puuid === '' ? null : puuid
}

/** Current UI locale (ADR-009); the engine/coach/updater translator source. */
export function getLocale(db: AppDatabase): Locale {
  return normalizeLocale(new SettingsRepo(db).get(SETTING_KEYS.locale))
}

export function registerRiotIpc(db: AppDatabase): void {
  const settings = new SettingsRepo(db)
  /** Translator at the CURRENT locale — errors reach the renderer localized. */
  const tr = (): Translator => createTranslator(normalizeLocale(settings.get(SETTING_KEYS.locale)))

  const readSoundVolume = (): number => {
    const raw = Number(settings.get(SETTING_KEYS.soundVolume) ?? '60')
    return Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : 60
  }
  const readSoundCategories = (): { recommendation: boolean; spike: boolean; objective: boolean } => {
    const muted = new Set((settings.get(SETTING_KEYS.soundMuted) ?? '').split(','))
    return {
      recommendation: !muted.has('recommendation'),
      spike: !muted.has('spike'),
      objective: !muted.has('objective')
    }
  }

  handleInvoke('settings:get', () => ({
    riotId: settings.get(SETTING_KEYS.riotId),
    platform: settings.get(SETTING_KEYS.platform) ?? 'euw1',
    recordLive: settings.get(SETTING_KEYS.recordLive) === '1',
    soundsEnabled: settings.get(SETTING_KEYS.soundsEnabled) !== '0',
    soundVolume: readSoundVolume(),
    soundCategories: readSoundCategories(),
    overlayEnabled: settings.get(SETTING_KEYS.overlayEnabled) === '1',
    theme: normalizeTheme(settings.get(SETTING_KEYS.theme)),
    locale: normalizeLocale(settings.get(SETTING_KEYS.locale)),
    // Only the flag crosses IPC — the key itself never reaches the renderer.
    apiKeySet: hasApiKey(settings, keyCodec)
  }))

  handleInvoke('settings:set', (update) => {
    const riotId = normalizeRiotId(update.riotId)
    const previousRiotId = settings.get(SETTING_KEYS.riotId)
    settings.set(SETTING_KEYS.riotId, riotId)
    settings.set(SETTING_KEYS.platform, update.platform)
    settings.set(SETTING_KEYS.recordLive, update.recordLive ? '1' : '0')
    settings.set(SETTING_KEYS.soundsEnabled, update.soundsEnabled ? '1' : '0')
    settings.set(
      SETTING_KEYS.soundVolume,
      String(Math.min(100, Math.max(0, Math.round(update.soundVolume))))
    )
    settings.set(
      SETTING_KEYS.soundMuted,
      (['recommendation', 'spike', 'objective'] as const)
        .filter((category) => !update.soundCategories[category])
        .join(',')
    )
    settings.set(SETTING_KEYS.overlayEnabled, update.overlayEnabled ? '1' : '0')
    settings.set(SETTING_KEYS.theme, update.theme)
    settings.set(SETTING_KEYS.locale, normalizeLocale(update.locale))
    // undefined = leave the stored key untouched; '' clears it.
    if (update.apiKey !== undefined) storeApiKey(settings, keyCodec, update.apiKey)
    const puuid = settings.get(SETTING_KEYS.puuid)
    if (previousRiotId !== riotId) settings.set(SETTING_KEYS.puuid, '')
    if (previousRiotId !== riotId || ((puuid === null || puuid === '') && update.apiKey !== undefined)) {
      // riotId changed (or a key just arrived for an unresolved account) →
      // re-resolve the puuid in the background so post-game auto-ingest
      // works without a full sync.
      const apiKey = resolveApiKey(settings, keyCodec)
      if (apiKey !== null && riotId.includes('#')) {
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
    if (ingestRunning) return { started: false as const, error: tr()('err.syncInProgress') }

    const apiKey = resolveApiKey(settings, keyCodec)
    if (apiKey === null) {
      return { started: false as const, error: tr()('err.missingKey') }
    }
    // Normalize on read too: values saved before this fix may still carry
    // the invisible characters.
    const riotId = normalizeRiotId(settings.get(SETTING_KEYS.riotId) ?? '')
    if (riotId === '' || !riotId.includes('#')) {
      return { started: false as const, error: tr()('err.missingRiotId') }
    }
    const platform = settings.get(SETTING_KEYS.platform) ?? 'euw1'
    const client = new RiotClient({ apiKey, platform, limiter })

    const [gameName = '', tagLine = ''] = riotId.split('#', 2)
    let puuid = settings.get(SETTING_KEYS.puuid)
    if (puuid === null || puuid === '') {
      const account = await client.accountByRiotId(gameName, tagLine)
      if (!account.ok) {
        return { started: false as const, error: tr()('err.accountNotFound', { message: account.error.message }) }
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

  handleInvoke('meta:crawl:start', async () => {
    const apiKey = resolveApiKey(settings, keyCodec)
    if (apiKey === null) {
      return { started: false, error: tr()('err.missingKey') }
    }
    const platform = settings.get(SETTING_KEYS.platform) ?? 'euw1'
    // Completion-order stats only count finished build pieces (WP-015).
    const staticData = await getStaticDataManager()
      .load()
      .catch(() => null)
    if (staticData === null) {
      return { started: false, error: tr()('err.staticUnavailable') }
    }
    metaCrawler ??= new MetaCrawler({
      client: new RiotClient({ apiKey, platform, limiter }),
      repo: metaRepo,
      onProgress: (status) => broadcast('meta:progress', status),
      isOrderable: (itemId) => {
        const node = staticData.itemGraph.nodes.get(itemId)
        return node !== undefined && isFinishedBuildItem(node)
      },
      t: tr(),
      log: (message) => console.log(message)
    })
    return metaCrawler.start()
  })

  handleInvoke('meta:crawl:stop', () => {
    metaCrawler?.stop()
    return { stopped: true as const }
  })
}
