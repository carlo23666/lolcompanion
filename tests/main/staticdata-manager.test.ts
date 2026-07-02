import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaticDataManager, comparePatchDesc } from '@main/staticdata/manager'

const PATCH = '16.13.1'
const fixtureDir = join(import.meta.dirname, '..', '..', 'fixtures', 'ddragon', PATCH)

/** Fake fetch serving the committed fixture files. */
function fixtureFetch(): typeof fetch & { mock: ReturnType<typeof vi.fn>['mock'] } {
  return vi.fn().mockImplementation((input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.endsWith('/api/versions.json')) {
      return Promise.resolve(new Response(JSON.stringify([PATCH, '16.12.1'])))
    }
    const file = url.split('/').pop()
    if (file && ['item.json', 'champion.json', 'runesReforged.json'].includes(file)) {
      return Promise.resolve(new Response(readFileSync(join(fixtureDir, file), 'utf8')))
    }
    return Promise.resolve(new Response('not found', { status: 404 }))
  }) as typeof fetch & { mock: ReturnType<typeof vi.fn>['mock'] }
}

const offlineFetch = (): typeof fetch => vi.fn().mockRejectedValue(new Error('offline'))

describe('StaticDataManager', () => {
  let cacheDir: string
  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'staticdata-'))
  })
  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true })
  })

  it('cold start downloads and caches; derived structures work', async () => {
    const fetchFn = fixtureFetch()
    const manager = new StaticDataManager({ cacheDir, fetchFn })
    const data = await manager.load()

    expect(data.patch).toBe(PATCH)
    expect(data.items.get(3031)?.name).toBe('Filo infinito')
    expect(data.champions.get('Annie')?.stats.hp).toBe(560)
    expect(data.championsByName.get('Wukong')?.id).toBe('MonkeyKing')
    expect(data.championsByKey.get(1)?.id).toBe('Annie')
    expect(data.damageProfile('Zed')).toBe('physical')
    expect(data.damageProfile('UnknownFutureChamp')).toBe('mixed')
    // versions.json + 3 files
    expect(fetchFn.mock.calls.length).toBe(4)
  })

  it('second start with network down serves entirely from cache', async () => {
    const warm = new StaticDataManager({ cacheDir, fetchFn: fixtureFetch() })
    await warm.load()

    const offline = new StaticDataManager({ cacheDir, fetchFn: offlineFetch() })
    const data = await offline.load()
    expect(data.patch).toBe(PATCH)
    expect(data.itemGraph.nodes.get(3031)?.totalGold).toBe(3500)
  })

  it('same patch is never re-downloaded', async () => {
    const fetchFn = fixtureFetch()
    const first = new StaticDataManager({ cacheDir, fetchFn })
    await first.load()
    const second = new StaticDataManager({ cacheDir, fetchFn })
    await second.load()
    // 4 calls for the cold start + 1 versions.json check for the second load
    expect(fetchFn.mock.calls.length).toBe(5)
  })

  it('throws a clear error with no network and no cache', async () => {
    const manager = new StaticDataManager({ cacheDir, fetchFn: offlineFetch() })
    await expect(manager.load()).rejects.toThrow(/no cached patch/i)
  })

  it('sorts patches newest first', () => {
    expect(['16.9.1', '16.13.1', '16.10.1'].sort(comparePatchDesc)).toEqual([
      '16.13.1',
      '16.10.1',
      '16.9.1'
    ])
  })
})
