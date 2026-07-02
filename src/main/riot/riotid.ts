/**
 * Riot IDs pasted from the League client carry invisible Unicode format
 * characters (BiDi isolates U+2066/U+2069 around name and tag, sometimes
 * zero-width chars), which make account-v1 lookups 404. Strip every
 * format-category character (\p{Cf}) and trim whitespace around both parts.
 */
export function normalizeRiotId(riotId: string): string {
  const stripped = riotId.replace(/\p{Cf}/gu, '')
  const hashIndex = stripped.indexOf('#')
  if (hashIndex === -1) return stripped.trim()
  const gameName = stripped.slice(0, hashIndex).trim()
  const tagLine = stripped.slice(hashIndex + 1).trim()
  return `${gameName}#${tagLine}`
}
