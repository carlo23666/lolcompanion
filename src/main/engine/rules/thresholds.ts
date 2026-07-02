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
   * Expected average effective HP of a team at time t (seconds):
   * baseline(t) = 900 + 2.2 * t. Recalibrated 2026-07-02 against 100 real
   * ingested matches (per-minute median of mean enemy eHP reconstructed from
   * timelines): min 20 ≈ 3278, min 30 ≈ 4854 — the previous 1.9/s slope
   * (fixture-calibrated) undershot mid-late and made half of all real games
   * trip the tank triggers. 2.2/s fits min 20-34 within ~4%; slight early
   * overshoot is fine (anti-tank buys are never right pre-14 anyway).
   */
  TANK_BASELINE_BASE: 900,
  TANK_BASELINE_PER_S: 2.2,
  /** Team counts as tanky above baseline * this factor. */
  TANK_TEAM_FACTOR: 1.15,
  /**
   * A single enemy counts as a raid boss above baseline * this factor.
   * With the 2.2/s baseline, 1.55 puts the trigger between the real p50 and
   * p90 of the tankiest enemy mid-game (fires in roughly a quarter of games
   * at min 20 instead of half with the old 1.45 x 1.9/s pair).
   */
  TANK_SOLO_FACTOR: 1.55,

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
