import type { DashboardData } from "@/lib/data";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Declarative rule definition evaluated against a full {@link DashboardData} snapshot.
 */
export type Rule = {
  id: string;
  name: string;
  evaluate: (data: DashboardData) => boolean;
  insight: string;
  action: string;
  severity: "info" | "warning" | "critical";
  category: "revenue" | "growth" | "retention" | "efficiency";
};

/**
 * One fired rule after evaluation — includes metadata for UI and analytics.
 */
export type BusinessResult = {
  ruleId: string;
  name: string;
  insight: string;
  action: string;
  severity: Rule["severity"];
  category: Rule["category"];
};

export const RULE_IMPACT_MAP: Record<string, string> = {
  revenue_7day_trend: "Sustained downward momentum is harder to reverse than a single dip.",
  revenue_vs_average: "Falling below your own average signals structural change, not noise.",
  conversion_compression: "Fewer conversions mean your acquisition spend yields less revenue per dollar.",
  elevated_churn: "Every lost customer costs 5x more to replace than to retain.",
  retention_revenue_stress: "Simultaneous churn and revenue decline compresses margins from both sides.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arithmetic mean. Returns `0` for an empty array to keep downstream rules safe.
 */
export function mean(arr: readonly number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

/**
 * Population standard deviation: sqrt( mean( (x - mean)^2 ) ).
 * Returns `0` for an empty array.
 */
export function standardDeviation(arr: readonly number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  const variance =
    arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Returns the last `n` elements of `arr`.
 * If `n` exceeds the array length, returns a shallow copy of the full array.
 */
export function getLastN(arr: readonly number[], n: number): number[] {
  if (n <= 0) return [];
  if (n >= arr.length) return [...arr];
  return arr.slice(-n);
}

/**
 * Ordinary least-squares slope of `arr` against x = 0, 1, …, n-1.
 * Returns `0` when fewer than two points (no definable trend).
 *
 * Formula: (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)
 */
export function linearRegressionSlope(arr: readonly number[]): number {
  const n = arr.length;
  if (n < 2) return 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = arr[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;

  return (n * sumXY - sumX * sumY) / denom;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule catalogue (minimum 8)
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum points needed for a 7-day rolling window. */
const WINDOW_7 = 7;

/** Minimum history for “last 7 vs previous 7” comparisons. */
const WINDOW_14 = 14;

/** Churn alert threshold (decimal): 2% = 0.02 */
const CHURN_ALERT = 0.02;

/** Relative volatility: coefficient of variation threshold (15% = 0.15) */
const CV_THRESHOLD = 0.15;

export const RULES: Rule[] = [
  // 1 — Revenue declining (7-day slope < 0)
  {
    id: "revenue-7d-slope-negative",
    name: "7-Day Revenue Trend",
    evaluate: (data) => {
      if (data.revenue.length < WINDOW_7) return false;
      return linearRegressionSlope(getLastN(data.revenue, WINDOW_7)) < 0;
    },
    insight:
      "Revenue has a negative trend over the most recent 7 days (downward slope).",
    action:
      "Review recent pricing changes, acquisition spend, and top-of-funnel volume.",
    severity: "warning",
    category: "revenue",
  },

  // 2 — Latest revenue below full-period average
  {
    id: "revenue-below-period-mean",
    name: "Revenue vs 30-Day Average",
    evaluate: (data) => {
      if (data.revenue.length === 0) return false;
      const latest = data.revenue[data.revenue.length - 1];
      return latest < mean(data.revenue);
    },
    insight:
      "The latest daily revenue is below the average across the full history window.",
    action:
      "Drill into daily cohorts and channel mix; validate whether this is seasonal or structural.",
    severity: "warning",
    category: "revenue",
  },

  // 3 — Customer growth negative (first vs last)
  {
    id: "customer-growth-negative",
    name: "Customer Count Trajectory",
    evaluate: (data) => {
      if (data.customers.length < 2) return false;
      const first = data.customers[0];
      const last = data.customers[data.customers.length - 1];
      return last < first;
    },
    insight:
      "Active customer counts are lower at the end of the window than at the start.",
    action:
      "Prioritize retention plays and win-back campaigns; audit onboarding drop-off.",
    severity: "warning",
    category: "growth",
  },

  // 4 — Conversion rate: last 7 days weaker than prior 7
  {
    id: "conversion-rate-week-over-week-down",
    name: "Conversion Rate Compression",
    evaluate: (data) => {
      const cr = data.conversionRate;
      if (cr.length < WINDOW_14) return false;
      const last7 = cr.slice(-WINDOW_7);
      const prev7 = cr.slice(-WINDOW_14, -WINDOW_7);
      return mean(last7) < mean(prev7);
    },
    insight:
      "Conversion rate in the last 7 days is lower than in the preceding 7 days.",
    action:
      "Inspect funnel steps, landing-page experiments, and lead quality from paid channels.",
    severity: "warning",
    category: "growth",
  },

  // 5 — Churn above 2%
  {
    id: "churn-above-two-percent",
    name: "Elevated Churn",
    evaluate: (data) => {
      if (data.churnRate.length === 0) return false;
      const latest = data.churnRate[data.churnRate.length - 1];
      return latest > CHURN_ALERT;
    },
    insight: `Latest daily churn exceeds ${CHURN_ALERT * 100}% (threshold breach).`,
    action:
      "Launch exit surveys, review product quality incidents, and tighten proactive success outreach.",
    severity: "warning",
    category: "retention",
  },

  // 6 — AOV declining (negative trend across full series)
  {
    id: "avg-order-value-trend-down",
    name: "Average Order Value Trend",
    evaluate: (data) => {
      if (data.avgOrderValue.length < 2) return false;
      return linearRegressionSlope(data.avgOrderValue) < 0;
    },
    insight:
      "Average order value shows a negative linear trend across the observation window.",
    action:
      "Test bundling, upsell placements, and free-shipping thresholds.",
    severity: "warning",
    category: "efficiency",
  },

  // 7 — Revenue volatility (CV > 15%)
  {
    id: "revenue-high-volatility",
    name: "Revenue Volatility",
    evaluate: (data) => {
      const m = mean(data.revenue);
      if (m <= 0) return false;
      const cv = standardDeviation(data.revenue) / m;
      return cv > CV_THRESHOLD;
    },
    insight:
      "Revenue fluctuates sharply relative to its mean (coefficient of variation > 15%).",
    action:
      "Stabilize demand with subscriptions or deposits; investigate one-off spikes and refunds.",
    severity: "info",
    category: "revenue",
  },

  // 8 — CRITICAL: churn rising AND revenue falling (7-day windows)
  {
    id: "critical-churn-up-revenue-down",
    name: "Retention–Revenue Stress",
    evaluate: (data) => {
      if (data.revenue.length < WINDOW_7 || data.churnRate.length < WINDOW_7) {
        return false;
      }
      const revSlope = linearRegressionSlope(getLastN(data.revenue, WINDOW_7));
      const churnSlope = linearRegressionSlope(getLastN(data.churnRate, WINDOW_7));
      return churnSlope > 0 && revSlope < 0;
    },
    insight:
      "Churn is increasing while revenue is decreasing over the latest 7-day window — dual headwinds.",
    action:
      "Executive review: align product, success, and GTM on churn drivers and revenue levers immediately.",
    severity: "critical",
    category: "retention",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Severity ordering
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<Rule["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates every rule in {@link RULES} against `data`.
 * Returns only rules that matched, sorted by severity (critical → warning → info).
 */
export function evaluateBusiness(data: DashboardData): BusinessResult[] {
  const matched: BusinessResult[] = [];

  for (const rule of RULES) {
    if (!rule.evaluate(data)) continue;
    matched.push({
      ruleId: rule.id,
      name: rule.name,
      insight: rule.insight,
      action: rule.action,
      severity: rule.severity,
      category: rule.category,
    });
  }

  matched.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return matched;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the rule definition for `id`, or `undefined` if not found.
 */
export function getRuleById(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id);
}

/**
 * Returns all rule definitions in a given `category`.
 */
export function getRulesByCategory(category: Rule["category"]): Rule[] {
  return RULES.filter((r) => r.category === category);
}

/**
 * Counts how many evaluated results exist at each severity level.
 */
export function getSeverityCount(results: readonly BusinessResult[]): {
  info: number;
  warning: number;
  critical: number;
} {
  const counts = { info: 0, warning: 0, critical: 0 };
  for (const r of results) {
    counts[r.severity]++;
  }
  return counts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard compatibility helpers (rounded for display)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mean of `arr`, rounded to the nearest integer (legacy dashboard cards).
 */
export function calcAverage(arr: readonly number[]): number {
  return Math.round(mean(arr));
}

/**
 * Percent change from the first to the last element: ((last − first) / first) × 100,
 * rounded to one decimal place. Returns `NaN` if `first === 0`.
 */
export function calcDeltaPercent(arr: readonly number[]): number {
  if (arr.length === 0) return 0;
  const first = arr[0];
  const last = arr[arr.length - 1];
  if (first === 0) return last === 0 ? 0 : NaN;
  return Math.round(((last - first) / first) * 100 * 10) / 10;
}
