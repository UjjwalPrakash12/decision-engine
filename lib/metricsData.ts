import type { DashboardData } from "@/lib/data";
import type { Database } from "@/types/supabase";

type DailyMetricRow = Database["public"]["Tables"]["daily_metrics"]["Row"];

export function emptyDashboardData(): DashboardData {
  return {
    revenue: [],
    customers: [],
    conversionRate: [],
    churnRate: [],
    avgOrderValue: [],
    labels: [],
  };
}

export function mapRowsToDashboardData(rows: DailyMetricRow[]): DashboardData {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  return {
    revenue: sorted.map((r) => r.revenue),
    customers: sorted.map((r) => r.customers),
    conversionRate: sorted.map((r) => r.conversion_rate),
    churnRate: sorted.map((r) => r.churn_rate),
    avgOrderValue: sorted.map((r) => r.avg_order_value),
    labels: sorted.map((r) => r.date),
  };
}
