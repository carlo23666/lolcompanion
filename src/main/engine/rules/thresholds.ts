/**
 * Tunable thresholds for the v1 rules. Each number documents WHY it is what
 * it is. Calibrated against the committed fixtures (see worklog WP-007);
 * WP-011 backtesting drives the next tuning pass.
 */
export const THRESHOLDS = {
  /**
   * Enemy healing index (weighted healer champs + 0.5/lifesteal item) at
   * which antiheal becomes worth 800 gold. Two real sustain sources
   * (e.g. Soraka 2 + Aatrox 2) = 4; incidental Doran's lifesteal alone ~1.
   */
  ANTIHEAL_MIN_INDEX: 3.5,
  /** Above this, antiheal is urgent (enchanter + drain tank + items). */
  ANTIHEAL_URGENT_INDEX: 5.5,

  /**
   * Damage-type share above which the enemy team counts as skewed and
   * stacking the matching resist is clearly right. 62% ≈ 4 of 5 players
   * dealing one type after gold weighting.
   */
  DAMAGE_SKEW_SHARE: 0.62,

  /**
   * Expected average effective HP of a NON-tank team at time t (seconds):
   * baseline(t) = 900 + 1.9 * t. Matches the fixture curve for a squishy comp
   * (early ~1470, mid ~2600, late ~4300).
   */
  TANK_BASELINE_BASE: 900,
  TANK_BASELINE_PER_S: 1.9,
  /** Team counts as tanky above baseline * this factor. */
  TANK_TEAM_FACTOR: 1.15,
  /** A single enemy counts as a raid boss above baseline * this factor. */
  TANK_SOLO_FACTOR: 1.45,

  /**
   * Fed burst threat: kills - deaths at least this AND at least MIN_KILLS.
   * +4 means roughly two item spikes ahead of even.
   */
  FED_KD_DIFF: 4,
  FED_MIN_KILLS: 5,

  /**
   * spike-now: if the next completion is missing at most this much gold,
   * recommend waiting instead of spending on smaller pieces (one wave + a
   * couple of CS ≈ 150 gold).
   */
  SPIKE_WAIT_WINDOW_GOLD: 150,
  /**
   * Ignore completions further away than this (not a "spike now" call).
   * 800 covers the most expensive common recipes (e.g. Infinity Edge: 725).
   */
  SPIKE_MAX_MISSING_GOLD: 800
} as const
