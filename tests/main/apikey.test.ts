import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { runMigrations, type AppDatabase } from '@main/db'
import { SettingsRepo, SETTING_KEYS } from '@main/db/repos/settings'
import {
  createSafeStorageCodec,
  hasApiKey,
  resolveApiKey,
  storeApiKey,
  type KeyCodec
} from '@main/riot/apikey'

/** Reversible fake standing in for safeStorage (tests run outside Electron proper). */
const fakeCodec: KeyCodec = {
  encrypt: (plain) => `x:${Buffer.from(plain).toString('base64')}`,
  decrypt: (stored) =>
    stored.startsWith('x:') ? Buffer.from(stored.slice(2), 'base64').toString() : null
}

describe('resolveApiKey', () => {
  let db: AppDatabase
  let settings: SettingsRepo
  const envBefore = process.env['RIOT_API_KEY']

  beforeEach(() => {
    delete process.env['RIOT_API_KEY']
    db = new Database(':memory:')
    runMigrations(db)
    settings = new SettingsRepo(db)
  })

  afterEach(() => {
    db.close()
    if (envBefore === undefined) delete process.env['RIOT_API_KEY']
    else process.env['RIOT_API_KEY'] = envBefore
  })

  it('returns null when nothing is configured', () => {
    expect(resolveApiKey(settings, fakeCodec)).toBeNull()
    expect(hasApiKey(settings, fakeCodec)).toBe(false)
  })

  it('round-trips a stored key and trims whitespace', () => {
    storeApiKey(settings, fakeCodec, '  RGAPI-abc-123  ')
    expect(resolveApiKey(settings, fakeCodec)).toBe('RGAPI-abc-123')
    expect(hasApiKey(settings, fakeCodec)).toBe(true)
    // The key is never stored in the clear.
    expect(settings.get(SETTING_KEYS.apiKey)).not.toContain('RGAPI-abc-123')
  })

  it('env RIOT_API_KEY takes precedence over the stored key', () => {
    storeApiKey(settings, fakeCodec, 'RGAPI-stored')
    process.env['RIOT_API_KEY'] = 'RGAPI-env'
    expect(resolveApiKey(settings, fakeCodec)).toBe('RGAPI-env')
  })

  it('empty string clears the stored key', () => {
    storeApiKey(settings, fakeCodec, 'RGAPI-abc')
    storeApiKey(settings, fakeCodec, '')
    expect(resolveApiKey(settings, fakeCodec)).toBeNull()
  })

  it('an undecryptable stored value resolves to null instead of throwing', () => {
    settings.set(SETTING_KEYS.apiKey, 'garbage-from-another-machine')
    expect(resolveApiKey(settings, fakeCodec)).toBeNull()
  })
})

describe('createSafeStorageCodec', () => {
  const xor = (buffer: Buffer): Buffer => Buffer.from(buffer.map((byte) => byte ^ 0x5a))
  const available = {
    isEncryptionAvailable: () => true,
    encryptString: (plain: string) => xor(Buffer.from(plain)),
    decryptString: (encrypted: Buffer) => xor(encrypted).toString()
  }

  it('round-trips through the OS encryptor with the enc1: prefix', () => {
    const codec = createSafeStorageCodec(available)
    const stored = codec.encrypt('RGAPI-secret')
    expect(stored.startsWith('enc1:')).toBe(true)
    expect(stored).not.toContain('RGAPI-secret')
    expect(codec.decrypt(stored)).toBe('RGAPI-secret')
  })

  it('falls back to the plain: prefix when encryption is unavailable', () => {
    const codec = createSafeStorageCodec({ ...available, isEncryptionAvailable: () => false })
    const stored = codec.encrypt('RGAPI-secret')
    expect(stored).toBe('plain:RGAPI-secret')
    expect(codec.decrypt(stored)).toBe('RGAPI-secret')
  })

  it('returns null when the OS refuses to decrypt (other user profile)', () => {
    const codec = createSafeStorageCodec({
      ...available,
      decryptString: () => {
        throw new Error('DPAPI failure')
      }
    })
    expect(codec.decrypt(codec.encrypt('RGAPI-secret'))).toBeNull()
  })
})
