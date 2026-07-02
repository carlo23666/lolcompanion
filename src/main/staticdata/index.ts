import { join } from 'node:path'
import { app } from 'electron'
import { StaticDataManager } from './manager'

export { StaticDataManager, comparePatchDesc } from './manager'
export type { StaticData, DamageType } from './manager'
export { buildItemGraph, componentTree, upgradeChain } from './itemgraph'
export type { ItemGraph, ItemNode } from './itemgraph'
export {
  championStatsAtLevel,
  statAtLevel,
  attackSpeedAtLevel,
  growthMultiplier
} from './champstats'
export { goldEfficiency, GOLD_PER_STAT } from './goldefficiency'

let manager: StaticDataManager | null = null

/** App-wide singleton backed by the userData cache dir. */
export function getStaticDataManager(): StaticDataManager {
  manager ??= new StaticDataManager({
    cacheDir: join(app.getPath('userData'), 'staticdata')
  })
  return manager
}
