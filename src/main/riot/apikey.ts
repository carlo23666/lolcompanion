import type { SettingsRepo } from '../db/repos/settings'
import { SETTING_KEYS } from '../db/repos/settings'

/**
 * Riot API key resolution for installed (no .env) machines.
 *
 * Precedence: `RIOT_API_KEY` from the process environment (dev `.env`,
 * loaded at startup) always wins; otherwise the key stored from Ajustes.
 * The stored value is encrypted with Electron safeStorage (DPAPI on
 * Windows) when available — the codec is injected so the logic stays
 * testable outside Electron. The key must never be logged or sent to the
 * renderer; only a boolean "a key is configured" flag crosses IPC.
 */
export interface KeyCodec {
  /** Plain key → storable string (opaque). */
  encrypt(plain: string): string
  /** Storable string → plain key, or null when it cannot be recovered. */
  decrypt(stored: string): string | null
}

const ENCRYPTED_PREFIX = 'enc1:'
const PLAIN_PREFIX = 'plain:'

/**
 * Codec over Electron safeStorage. Falls back to an obfuscation-free
 * prefix when the OS keychain is unavailable (headless Linux without a
 * secret service) — still better than refusing to work, and the DB lives
 * in the user's own profile.
 */
export function createSafeStorageCodec(safeStorage: {
  isEncryptionAvailable(): boolean
  encryptString(plain: string): Buffer
  decryptString(encrypted: Buffer): string
}): KeyCodec {
  return {
    encrypt(plain) {
      if (safeStorage.isEncryptionAvailable()) {
        return ENCRYPTED_PREFIX + safeStorage.encryptString(plain).toString('base64')
      }
      return PLAIN_PREFIX + plain
    },
    decrypt(stored) {
      if (stored.startsWith(ENCRYPTED_PREFIX)) {
        try {
          return safeStorage.decryptString(Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), 'base64'))
        } catch {
          // Key stored on another machine/user profile — treat as absent.
          return null
        }
      }
      if (stored.startsWith(PLAIN_PREFIX)) return stored.slice(PLAIN_PREFIX.length)
      return null
    }
  }
}

/** Effective API key: env (dev) first, then the stored one. Null = unconfigured. */
export function resolveApiKey(settings: SettingsRepo, codec: KeyCodec): string | null {
  const env = process.env['RIOT_API_KEY']
  if (env !== undefined && env !== '') return env
  const stored = settings.get(SETTING_KEYS.apiKey)
  if (stored === null || stored === '') return null
  const key = codec.decrypt(stored)
  return key === null || key === '' ? null : key
}

/** True when some key would resolve (without exposing it). */
export function hasApiKey(settings: SettingsRepo, codec: KeyCodec): boolean {
  return resolveApiKey(settings, codec) !== null
}

/** Store a key typed in Ajustes; empty string clears it. Whitespace is trimmed. */
export function storeApiKey(settings: SettingsRepo, codec: KeyCodec, key: string): void {
  const trimmed = key.trim()
  settings.set(SETTING_KEYS.apiKey, trimmed === '' ? '' : codec.encrypt(trimmed))
}
