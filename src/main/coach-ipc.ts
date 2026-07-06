import type { AppDatabase } from './db'
import { SettingsRepo, SETTING_KEYS } from './db/repos/settings'
import { handleInvoke } from './ipc'
import {
  buildCoachPrompt,
  DEFAULT_COACH_MODEL,
  generateCoachAdvice,
  ollamaStatus
} from './coach'

/** IPC surface for the local-AI coach — kept out of coach.ts so the pure
 * prompt/transport logic stays importable in tests without electron. */
export function registerCoachIpc(db: AppDatabase): void {
  const settings = new SettingsRepo(db)

  handleInvoke('coach:status', async () => {
    const status = await ollamaStatus()
    return {
      enabled: settings.get(SETTING_KEYS.coachEnabled) === '1',
      model: settings.get(SETTING_KEYS.coachModel) ?? DEFAULT_COACH_MODEL,
      ...status
    }
  })

  handleInvoke('coach:configure', (config) => {
    settings.set(SETTING_KEYS.coachEnabled, config.enabled ? '1' : '0')
    settings.set(SETTING_KEYS.coachModel, config.model)
    return { saved: true as const }
  })

  handleInvoke('coach:analyze', async (report) => {
    if (settings.get(SETTING_KEYS.coachEnabled) !== '1') {
      return { ok: false as const, error: 'Coach desactivado (Ajustes)' }
    }
    const model = settings.get(SETTING_KEYS.coachModel) ?? DEFAULT_COACH_MODEL
    return generateCoachAdvice(model, buildCoachPrompt(report))
  })
}
