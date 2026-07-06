import type { AppDatabase } from '../index'

/** Key-value settings on top of the meta table (migration 001). */
export class SettingsRepo {
  constructor(private readonly db: AppDatabase) {}

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, value)
  }
}

export const SETTING_KEYS = {
  riotId: 'settings.riotId',
  /** Riot API key stored from Ajustes (safeStorage-encrypted, see riot/apikey.ts). */
  apiKey: 'settings.apiKey',
  platform: 'settings.platform',
  puuid: 'settings.puuid',
  recordLive: 'settings.recordLive',
  soundsEnabled: 'settings.soundsEnabled',
  soundVolume: 'settings.soundVolume',
  /** Comma-separated disabled categories (default: none disabled). */
  soundMuted: 'settings.soundMuted',
  overlayEnabled: 'settings.overlayEnabled',
  theme: 'settings.theme',
  /** Local-AI coach over Ollama (see main/coach.ts, main/coach-live.ts). */
  coachEnabled: 'settings.coachEnabled',
  coachModel: 'settings.coachModel',
  coachLive: 'settings.coachLive'
} as const
