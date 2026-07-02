import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SnapshotRecorder } from '@main/liveclient/recorder'

describe('SnapshotRecorder', () => {
  let dir: string
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('writes snapshots into a session directory named by timestamp', () => {
    dir = mkdtempSync(join(tmpdir(), 'recorder-'))
    const recorder = new SnapshotRecorder(dir, () => new Date('2026-07-02T10:00:00Z'))
    const file = recorder.record({ gameData: { gameTime: 65.4 } }, 65.4)

    expect(file).toContain('2026-07-02T10-00-00')
    expect(file.endsWith('000065.json')).toBe(true)
    const written: unknown = JSON.parse(readFileSync(file, 'utf8'))
    expect(written).toEqual({ gameData: { gameTime: 65.4 } })
  })

  it('starts a new session directory when game time resets', () => {
    dir = mkdtempSync(join(tmpdir(), 'recorder-'))
    let now = new Date('2026-07-02T10:00:00Z')
    const recorder = new SnapshotRecorder(dir, () => now)
    recorder.record({}, 100)
    recorder.record({}, 102)
    now = new Date('2026-07-02T11:00:00Z')
    recorder.record({}, 5) // new game: time went backwards

    const sessions = readdirSync(dir)
    expect(sessions).toHaveLength(2)
  })
})
