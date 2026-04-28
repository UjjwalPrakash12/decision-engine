import type { DashboardData } from "@/lib/data";

export type ScenarioParams = {
  /** Revenue multiplier as percent delta, e.g. -20 = −20%. */
  revenuePct: number;
  /** Customer count multiplier as percent delta. */
  customerPct: number;
  /** Conversion rate shift in percentage points (e.g. +0.5 = +0.5pp on the decimal rate). */
  conversionPp: number;
  /** Churn rate shift in percentage points. */
  churnPp: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function cloneDashboardData(data: DashboardData): DashboardData {
  return {
    revenue: [...data.revenue],
    customers: [...data.customers],
    conversionRate: [...data.conversionRate],
    churnRate: [...data.churnRate],
    avgOrderValue: [...data.avgOrderValue],
    labels: [...data.labels],
  };
}

/**
 * Applies scenario adjustments to a deep-cloned view of `base`.
 * Conversion and churn shifts are added to each daily point (clamped to sane bounds).
 */
export function applyScenario(base: DashboardData, p: ScenarioParams): DashboardData {
  const convDelta = p.conversionPp / 100;
  const churnDelta = p.churnPp / 100;

  return {
    revenue: base.revenue.map((v) =>
      Math.round(v * (1 + p.revenuePct / 100)),
    ),
    customers: base.customers.map((v) =>
      Math.max(1, Math.round(v * (1 + p.customerPct / 100))),
    ),
    conversionRate: base.conversionRate.map((v) =>
      round2(clamp(v + convDelta, 0.005, 0.12)),
    ),
    churnRate: base.churnRate.map((v) =>
      round2(clamp(v + churnDelta, 0.005, 0.12)),
    ),
    avgOrderValue: base.avgOrderValue.map((v) => round2(v)),
    labels: [...base.labels],
  };
}
