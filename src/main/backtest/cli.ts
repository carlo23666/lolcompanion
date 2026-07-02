import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { matchSchema, timelineSchema } from '@shared/schemas/riot'
import { MatchRepo, TimelineRepo } from '../db/repos'
import { SettingsRepo, SETTING_KEYS } from '../db/repos/settings'
import { StaticDataManager } from '../staticdata/manager'
import { runBacktest, type BacktestInput, type BacktestReport } from './harness'

export interface CliOptions {
  champion?: string
  last?: number
  dbPath?: string
  staticDataDir?: string
  reportsDir?: string
  now?: () => Date
}

/** Default Electron userData location per platform (the CLI runs outside Electron). */
function defaultUserData(): string {
  switch (process.platform) {
    case 'win32':
      return join(process.env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'), 'lol-companion')
    case 'darwin':
      return join(homedir(), 'Library', 'Application Support', 'lol-companion')
    default:
      return join(process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config'), 'lol-companion')
  }
}

export async function runCliBacktest(options: CliOptions = {}): Promise<BacktestReport> {
  const userData = defaultUserData()
  const dbPath = options.dbPath ?? join(userData, 'lol-companion.db')
  if (!existsSync(dbPath)) {
    throw new Error(`No database found at ${dbPath} — run the app and sync first`)
  }
  const db = new Database(dbPath, { readonly: true })

  const settings = new SettingsRepo(db)
  const puuid = settings.get(SETTING_KEYS.puuid)
  if (puuid === null || puuid === '') {
    throw new Error('No puuid stored — configure your Riot ID and sync once')
  }

  const staticDataDir =
    options.staticDataDir ??
    (existsSync(join(userData, 'staticdata'))
      ? join(userData, 'staticdata')
      : join(process.cwd(), 'fixtures', 'ddragon'))
  const staticData = await new StaticDataManager({
    cacheDir: staticDataDir,
    fetchFn: () => Promise.reject(new Error('backtest runs offline'))
  }).load()

  const matchRepo = new MatchRepo(db)
  const timelineRepo = new TimelineRepo(db)

  const owned = matchRepo.ownerMatches(puuid, {
    champion: options.champion,
    limit: options.last ?? 100
  })
  const inputs: BacktestInput[] = []
  for (const { match } of owned) {
    const rawMatch = matchRepo.getMatchRaw(match.matchId)
    const rawTimeline = timelineRepo.getTimelineRaw(match.matchId)
    if (!rawMatch || !rawTimeline) continue
    const parsedMatch = matchSchema.safeParse(rawMatch)
    const parsedTimeline = timelineSchema.safeParse(rawTimeline)
    if (!parsedMatch.success || !parsedTimeline.success) continue
    inputs.push({ match: parsedMatch.data, timeline: parsedTimeline.data, ownerPuuid: puuid })
  }

  const report = runBacktest(inputs, staticData)
  db.close()

  const reportsDir = options.reportsDir ?? join(process.cwd(), 'reports')
  mkdirSync(reportsDir, { recursive: true })
  const stamp = (options.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-')
  const reportPath = join(reportsDir, `backtest-${stamp}.json`)
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  printReport(report, reportPath)
  return report
}

export function printReport(report: BacktestReport, reportPath?: string): void {
  const pct = (value: number): string => `${(value * 100).toFixed(1)}%`
  const lines: string[] = [
    '',
    '════════ BACKTEST REPORT ════════',
    `Matches: ${String(report.matches)}  Frames: ${String(report.frames)}  Comparisons: ${String(report.comparisons)}`,
    `Top-1 agreement: ${pct(report.top1Rate)}   Top-3 agreement: ${pct(report.top3Rate)}`,
    '',
    'By phase:',
    ...(['early', 'mid', 'late'] as const).map(
      (phase) =>
        `  ${phase.padEnd(6)} n=${String(report.byPhase[phase].comparisons).padStart(4)}  top1 ${pct(report.byPhase[phase].top1Rate)}  top3 ${pct(report.byPhase[phase].top3Rate)}`
    ),
    '',
    'By champion:',
    ...Object.entries(report.byChampion).map(
      ([champion, bucket]) =>
        `  ${champion.padEnd(14)} n=${String(bucket.comparisons).padStart(4)}  top1 ${pct(bucket.top1Rate)}  top3 ${pct(bucket.top3Rate)}`
    ),
    '',
    `Worst disagreements (${String(report.disagreements.length)}):`,
    ...report.disagreements
      .slice(0, 10)
      .map(
        (disagreement) =>
          `  [${disagreement.matchId} min ${String(disagreement.minute)}] ${disagreement.champion} compró ${disagreement.actualName}; recomendado: ${disagreement.top3.map((rec) => rec.itemName ?? '?').join(' / ')}`
      ),
    ...(report.errors.length > 0
      ? ['', `Errors: ${report.errors.map((error) => error.matchId).join(', ')}`]
      : []),
    ...(reportPath !== undefined ? ['', `JSON: ${reportPath}`] : []),
    ''
  ]
  console.log(lines.join('\n'))
}
