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
  platform: 'settings.platform',
  puuid: 'settings.puuid'
} as const
