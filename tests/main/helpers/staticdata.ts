import { join } from 'node:path'
import { StaticDataManager, type StaticData } from '@main/staticdata/manager'

/**
 * Loads StaticData straight from the committed ddragon fixtures directory
 * (offline: the fixtures dir doubles as a warm cache).
 */
export async function loadFixtureStaticData(): Promise<StaticData> {
  const manager = new StaticDataManager({
    cacheDir: join(import.meta.dirname, '..', '..', '..', 'fixtures', 'ddragon'),
    fetchFn: () => Promise.reject(new Error('offline'))
  })
  return manager.load()
}
