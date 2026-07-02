import type { AppDatabase } from './db'
import { HistoryService } from './history'
import { handleInvoke } from './ipc'
import { getOwnerPuuid } from './riot'

export function registerHistoryIpc(db: AppDatabase): void {
  const service = new HistoryService(db)
  handleInvoke('history:list', (filter) => {
    const puuid = getOwnerPuuid(db)
    return puuid === null ? [] : service.list(puuid, filter?.champion)
  })
  handleInvoke('history:aggregates', () => {
    const puuid = getOwnerPuuid(db)
    return puuid === null ? [] : service.aggregates(puuid)
  })
  handleInvoke('history:champions', () => {
    const puuid = getOwnerPuuid(db)
    return puuid === null ? [] : service.champions(puuid)
  })
  handleInvoke('history:detail', (matchId) => {
    const puuid = getOwnerPuuid(db)
    return puuid === null ? null : service.detail(puuid, matchId)
  })
}
