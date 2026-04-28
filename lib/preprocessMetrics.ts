import type { DashboardData } from "@/lib/data";

type MetricRow = {
  date: string;
  revenue: number;
  customers: number;
  conversionRate: number;
  churnRate: number;
  avgOrderValue: number;
};

const MS_DAY = 24 * 60 * 60 * 1000;

function isIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === date;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function safeRound(n: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function toRows(data: DashboardData): MetricRow[] {
  const n = Math.min(
    data.labels.length,
    data.revenue.length,
    data.customers.length,
    data.conversionRate.length,
    data.churnRate.length,
    data.avgOrderValue.length,
  );

  const rows: MetricRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      date: data.labels[i],
      revenue: data.revenue[i],
      customers: data.customers[i],
      conversionRate: data.conversionRate[i],
      churnRate: data.churnRate[i],
      avgOrderValue: data.avgOrderValue[i],
    });
  }
  return rows;
}

function fromRows(rows: MetricRow[]): DashboardData {
  return {
    labels: rows.map((r) => r.date),
    revenue: rows.map((r) => r.revenue),
    customers: rows.map((r) => r.customers),
    conversionRate: rows.map((r) => r.conversionRate),
    churnRate: rows.map((r) => r.churnRate),
    avgOrderValue: rows.map((r) => r.avgOrderValue),
  };
}

function cleanRow(r: MetricRow): MetricRow | null {
  if (!isIsoDate(r.date)) return null;
  if (
    !Number.isFinite(r.revenue) ||
    !Number.isFinite(r.customers) ||
    !Number.isFinite(r.conversionRate) ||
    !Number.isFinite(r.churnRate) ||
    !Number.isFinite(r.avgOrderValue)
  ) {
    return null;
  }
  return {
    date: r.date,
    revenue: Math.max(0, safeRound(r.revenue, 2)),
    customers: Math.max(0, Math.round(r.customers)),
    conversionRate: safeRound(clamp(r.conversionRate, 0, 1), 4),
    churnRate: safeRound(clamp(r.churnRate, 0, 1), 4),
    avgOrderValue: Math.max(0, safeRound(r.avgOrderValue, 2)),
  };
}

function interpolate(prev: MetricRow, next: MetricRow, t: number, date: string): MetricRow {
  return {
    date,
    revenue: safeRound(prev.revenue + (next.revenue - prev.revenue) * t, 2),
    customers: Math.max(0, Math.round(prev.customers + (next.customers - prev.customers) * t)),
    conversionRate: safeRound(
      clamp(prev.conversionRate + (next.conversionRate - prev.conversionRate) * t, 0, 1),
      4,
    ),
    churnRate: safeRound(
      clamp(prev.churnRate + (next.churnRate - prev.churnRate) * t, 0, 1),
      4,
    ),
    avgOrderValue: safeRound(prev.avgOrderValue + (next.avgOrderValue - prev.avgOrderValue) * t, 2),
  };
}

/**
 * Cleans dashboard metrics before rule evaluation.
 *
 * Assumptions:
 * - All metric arrays represent aligned daily observations by `labels`.
 * - Rows with invalid dates or non-finite numbers are dropped entirely.
 * - Missing date gaps are only interpolated when the gap is at most 2 days.
 * - Impossible values are clamped to safe domains:
 *   revenue/customers/avgOrderValue >= 0, rates in [0, 1].
 */
export function cleanDashboardData(input: DashboardData): DashboardData {
  const cleaned = toRows(input)
    .map(cleanRow)
    .filter((r): r is MetricRow => r !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (cleaned.length <= 1) {
    return fromRows(cleaned);
  }

  const withGapsFilled: MetricRow[] = [];
  for (let i = 0; i < cleaned.length - 1; i++) {
    const cur = cleaned[i];
    const nxt = cleaned[i + 1];
    withGapsFilled.push(cur);

    const curMs = new Date(`${cur.date}T00:00:00.000Z`).getTime();
    const nextMs = new Date(`${nxt.date}T00:00:00.000Z`).getTime();
    const gapDays = Math.round((nextMs - curMs) / MS_DAY) - 1;

    if (gapDays > 0 && gapDays <= 2) {
      for (let step = 1; step <= gapDays; step++) {
        const t = step / (gapDays + 1);
        const d = new Date(curMs + step * MS_DAY).toISOString().slice(0, 10);
        withGapsFilled.push(interpolate(cur, nxt, t, d));
      }
    }
  }
  withGapsFilled.push(cleaned[cleaned.length - 1]);

  return fromRows(withGapsFilled);
}
