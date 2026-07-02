import { readFileSync } from 'node:fs'
import https from 'node:https'

export type FetchAllGameData = () => Promise<unknown>

/**
 * HTTPS transport for the Live Client Data API with Riot's root certificate
 * pinned as the ONLY trusted CA. TLS verification is never disabled globally.
 *
 * The game client's certificate does not carry `127.0.0.1` as a SAN, so
 * hostname verification would always fail on the loopback connection. We keep
 * full chain-of-trust verification against the pinned Riot CA and skip only
 * the hostname check — the host is hard-coded to 127.0.0.1, never derived
 * from input. (Deviation from "native fetch": Node's fetch cannot pin a CA
 * per-request without the undici dependency; node:https is stdlib.)
 */
export function createLiveClientTransport(certPath: string): FetchAllGameData {
  const ca = readFileSync(certPath)
  return () =>
    new Promise((resolve, reject) => {
      const request = https.get(
        {
          host: '127.0.0.1',
          port: 2999,
          path: '/liveclientdata/allgamedata',
          ca,
          checkServerIdentity: () => undefined,
          timeout: 1500
        },
        (response) => {
          if (response.statusCode !== 200) {
            response.resume()
            reject(new Error(`Live Client responded ${String(response.statusCode)}`))
            return
          }
          let body = ''
          response.setEncoding('utf8')
          response.on('data', (chunk: string) => (body += chunk))
          response.on('end', () => {
            try {
              resolve(JSON.parse(body))
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)))
            }
          })
        }
      )
      request.on('timeout', () => request.destroy(new Error('Live Client request timed out')))
      request.on('error', reject)
    })
}
