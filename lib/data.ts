// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DashboardData = {
  /** Daily revenue in USD (whole dollars). */
  revenue: number[];
  /** Daily unique active customers. */
  customers: number[];
  /** Daily conversion rate as a decimal, e.g. 0.032 = 3.2%. */
  conversionRate: number[];
  /** Daily churn rate as a decimal, e.g. 0.015 = 1.5%. */
  churnRate: number[];
  /** Daily average order value in USD. */
  avgOrderValue: number[];
  /** ISO-8601 date strings (YYYY-MM-DD), one per data point. */
  labels: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Seeded pseudo-random number generator (LCG)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a deterministic pseudo-random number generator using a
 * Linear Congruential Generator (LCG) with the Numerical Recipes constants:
 *   a = 1_664_525   (multiplier)
 *   c = 1_013_904_223  (increment)
 *   m = 2^32        (modulus, implicit via unsigned 32-bit truncation)
 *
 * Math.imul is used for safe 32-bit integer multiplication that avoids
 * floating-point precision loss on large values.
 *
 * @returns A function that, on each call, advances the internal state and
 *          returns a deterministic float in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  const LCG_A = 1_664_525;
  const LCG_C = 1_013_904_223;

  // Ensure the initial state is a valid unsigned 32-bit integer.
  let state = seed >>> 0;

  return function random(): number {
    // Advance state: (a * state + c) mod 2^32
    state = (Math.imul(LCG_A, state) + LCG_C) >>> 0;
    // Normalise to [0, 1) by dividing by 2^32.
    return state / 0x1_0000_0000;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal math helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Linear interpolation: returns the value at position t (0–1) between a and b. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to `decimals` decimal places (0 = integer). */
function round(value: number, decimals: number = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the last element of an array.
 * Throws a RangeError if the array is empty so callers fail fast rather than
 * silently receiving `undefined`.
 */
export function getLatest<T>(arr: readonly T[]): T {
  if (arr.length === 0) {
    throw new RangeError("getLatest: called on an empty array");
  }
  return arr[arr.length - 1] as T;
}

/**
 * Returns the first element of an array.
 * Throws a RangeError if the array is empty.
 */
export function getFirst<T>(arr: readonly T[]): T {
  if (arr.length === 0) {
    throw new RangeError("getFirst: called on an empty array");
  }
  return arr[0] as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset configuration constants
// ─────────────────────────────────────────────────────────────────────────────

/** Seed that makes the dataset fully reproducible across environments. */
const SEED = 42;

/** Number of days to generate. */
const DAY_COUNT = 30;

/** Anchor: the final (most recent) date in the dataset. */
const ANCHOR_DATE = "2025-01-01";

// Revenue shape — three-phase arc (growth → peak → decline)
const REV_GROWTH_START = 8_000;  // Day 1  start of growth phase
const REV_GROWTH_END   = 10_000; // Day 10 end of growth / start of peak
const REV_PEAK_END     = 11_000; // Day 20 end of peak   / start of decline
const REV_DECLINE_END  = 9_500;  // Day 30 final value after decline

/** Multiplicative noise band: base * (1 ± REV_NOISE/2). ±8% daily jitter. */
const REV_NOISE = 0.16;

// Average order value — uniform random in [150, 220]
const AOV_MIN = 150;
const AOV_MAX = 220;

/** Multiplicative noise on customers derived from revenue/AOV. ±5% jitter. */
const CUST_NOISE = 0.10;

// Conversion rate — slight downward trend across the window
const CR_START  = 0.04; // 4% at day 0
const CR_END    = 0.02; // 2% at day 29
const CR_NOISE  = 0.008; // ±0.4% daily noise band

// Churn rate — slight upward trend across the window
const CH_START  = 0.01; // 1% at day 0
const CH_END    = 0.03; // 3% at day 29
const CH_NOISE  = 0.008; // ±0.4% daily noise band

// ─────────────────────────────────────────────────────────────────────────────
// Date-label generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an array of ISO-8601 date strings ending on ANCHOR_DATE.
 * Index 0 is the oldest day (29 days before anchor),
 * index 29 is ANCHOR_DATE itself.
 */
function buildLabels(): string[] {
  const anchorMs = new Date(ANCHOR_DATE).getTime();
  const MS_PER_DAY = 24 * 60 * 60 * 1_000;

  return Array.from({ length: DAY_COUNT }, (_, i) => {
    // i=0 → offset 29 days back; i=29 → offset 0 (anchor)
    const offset = (DAY_COUNT - 1 - i) * MS_PER_DAY;
    return new Date(anchorMs - offset).toISOString().slice(0, 10);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Data generation
// ─────────────────────────────────────────────────────────────────────────────

function generateDashboardData(): DashboardData {
  const rand = createSeededRandom(SEED);

  const revenue: number[]        = [];
  const customers: number[]      = [];
  const conversionRate: number[] = [];
  const churnRate: number[]      = [];
  const avgOrderValue: number[]  = [];
  const labels: string[]         = buildLabels();

  for (let i = 0; i < DAY_COUNT; i++) {
    // ── Average order value ────────────────────────────────────────────────
    // Uniform random in [AOV_MIN, AOV_MAX] with two decimal places.
    const aov = round(AOV_MIN + rand() * (AOV_MAX - AOV_MIN), 2);
    avgOrderValue.push(aov);

    // ── Revenue ────────────────────────────────────────────────────────────
    // Three-phase trend: growth (days 0–9) → peak (days 10–19) → decline (days 20–29).
    let baseRevenue: number;
    if (i < 10) {
      // Growth phase: linear ramp from REV_GROWTH_START to REV_GROWTH_END
      baseRevenue = lerp(REV_GROWTH_START, REV_GROWTH_END, i / 9);
    } else if (i < 20) {
      // Peak phase: linear ramp from REV_GROWTH_END to REV_PEAK_END
      baseRevenue = lerp(REV_GROWTH_END, REV_PEAK_END, (i - 10) / 9);
    } else {
      // Decline phase: linear ramp from REV_PEAK_END to REV_DECLINE_END
      baseRevenue = lerp(REV_PEAK_END, REV_DECLINE_END, (i - 20) / 9);
    }
    // Multiplicative noise: multiply base by a factor centred at 1.0.
    const revNoiseFactor = 1 + (rand() - 0.5) * REV_NOISE;
    revenue.push(round(baseRevenue * revNoiseFactor));

    // ── Customers ──────────────────────────────────────────────────────────
    // Derive from today's revenue and AOV, then add independent jitter.
    const baseCustomers = revenue[i] / aov;
    const custNoiseFactor = 1 + (rand() - 0.5) * CUST_NOISE;
    customers.push(Math.max(1, round(baseCustomers * custNoiseFactor)));

    // ── Conversion rate ────────────────────────────────────────────────────
    // Slight downward trend (CR_START → CR_END) plus small additive noise.
    const baseCR = lerp(CR_START, CR_END, i / (DAY_COUNT - 1));
    const cr = clamp(
      round(baseCR + (rand() - 0.5) * CR_NOISE, 4),
      CR_END,   // min
      CR_START, // max
    );
    conversionRate.push(cr);

    // ── Churn rate ─────────────────────────────────────────────────────────
    // Slight upward trend (CH_START → CH_END) plus small additive noise.
    const baseCH = lerp(CH_START, CH_END, i / (DAY_COUNT - 1));
    const ch = clamp(
      round(baseCH + (rand() - 0.5) * CH_NOISE, 4),
      CH_START, // min
      CH_END,   // max
    );
    churnRate.push(ch);
  }

  return { revenue, customers, conversionRate, churnRate, avgOrderValue, labels };
}

/**
 * Returns the last `days` observations from a parallel {@link DashboardData} snapshot.
 * Arrays are sliced with the same index range so rows stay aligned.
 * If `days` is greater than the available length, the full dataset is returned.
 */
export function sliceDashboardData(
  data: DashboardData,
  days: number,
): DashboardData {
  const len = data.revenue.length;
  if (len === 0 || days <= 0) {
    return {
      revenue: [],
      customers: [],
      conversionRate: [],
      churnRate: [],
      avgOrderValue: [],
      labels: [],
    };
  }
  const n = Math.min(Math.floor(days), len);
  const start = len - n;
  return {
    revenue: data.revenue.slice(start),
    customers: data.customers.slice(start),
    conversionRate: data.conversionRate.slice(start),
    churnRate: data.churnRate.slice(start),
    avgOrderValue: data.avgOrderValue.slice(start),
    labels: data.labels.slice(start),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

/** The full 30-day analytics dataset. Computed once at module load time. */
export const dashboardData: DashboardData = generateDashboardData();

/**
 * @deprecated Prefer `dashboardData`.
 * Kept for backward compatibility with consumers that destructure { metrics }.
 */
export const metrics = {
  revenue:   dashboardData.revenue,
  customers: dashboardData.customers,
} as const;

/**
 * @deprecated Prefer `dashboardData.labels`.
 * Kept for backward compatibility with consumers that destructure { dayLabels }.
 */
export const dayLabels: string[] = dashboardData.labels;
