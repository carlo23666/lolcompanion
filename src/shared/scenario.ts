/**
 * Dev tool: hand-crafted game situations. A GameScenario is turned into a
 * synthetic Live Client snapshot (main process) and fed through the REAL
 * pipeline, so every feature behaves exactly as in a live game.
 */

export interface ScenarioPlayerSpec {
  /** Data Dragon id ("Kaisa") or display name ("Kai'Sa"). */
  champion: string
  /** TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY | ''. */
  position?: string
  /** Defaults derived from gameTimeS when omitted. */
  level?: number
  kills?: number
  deaths?: number
  /** Item ids (final slots, order irrelevant). */
  items?: number[]
  dead?: boolean
}

export interface GameScenario {
  /** Seconds into the game. */
  gameTimeS: number
  /** Self current gold (activePlayer). */
  gold: number
  /** Adds the Magical Footwear rune (8304) to self. */
  magicalFootwear?: boolean
  self: ScenarioPlayerSpec
  /** Up to 4. */
  allies: ScenarioPlayerSpec[]
  /** Up to 5. */
  enemies: ScenarioPlayerSpec[]
}
