import type { AppDatabase } from './db'
import { HistoryService } from './history'
import { handleInvoke } from './ipc'
import { ReportService } from './report'
import { getOwnerPuuid } from './riot'
import { StatsService } from './stats'

/** Returns the StatsService so callers can invalidate its cache on new matches. */
export function registerHistoryIpc(db: AppDatabase): StatsService {
  const service = new HistoryService(db)
  const stats = new StatsService(db)
  const report = new ReportService(db, stats)
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
  handleInvoke('stats:overview', () => {
    const puuid = getOwnerPuuid(db)
    return puuid === null ? null : stats.overview(puuid)
  })
  handleInvoke('stats:curve', (champion) => {
    const puuid = getOwnerPuuid(db)
    return puuid === null ? null : stats.curve(puuid, champion)
  })
  handleInvoke('report:last', () => {
    const puuid = getOwnerPuuid(db)
    return puuid === null ? null : report.lastReport(puuid)
  })
  handleInvoke('report:forMatch', (matchId) => {
    const puuid = getOwnerPuuid(db)
    return puuid === null ? null : report.forMatch(puuid, matchId)
  })
  return stats
}
