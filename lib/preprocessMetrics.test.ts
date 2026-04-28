import { describe, expect, it } from "vitest";
import { cleanDashboardData } from "./preprocessMetrics";
import type { DashboardData } from "./data";

function sample(input?: Partial<DashboardData>): DashboardData {
  return {
    labels: ["2026-01-01", "2026-01-02", "2026-01-03"],
    revenue: [100, 120, 140],
    customers: [10, 12, 14],
    conversionRate: [0.02, 0.03, 0.04],
    churnRate: [0.01, 0.012, 0.014],
    avgOrderValue: [50, 55, 60],
    ...input,
  };
}

describe("cleanDashboardData", () => {
  it("sorts rows by ascending date", () => {
    const out = cleanDashboardData(
      sample({
        labels: ["2026-01-03", "2026-01-01", "2026-01-02"],
      }),
    );
    expect(out.labels).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(out.revenue).toEqual([120, 140, 100]);
  });

  it("drops rows with invalid dates or non-finite values", () => {
    const out = cleanDashboardData(
      sample({
        labels: ["2026-01-01", "bad-date", "2026-01-03"],
        revenue: [100, Number.NaN, 140],
      }),
    );
    // The invalid middle row is dropped, then the 1-day gap is interpolated.
    expect(out.labels).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(out.revenue).toEqual([100, 120, 140]);
  });

  it("fills small 1-2 day gaps via interpolation", () => {
    const out = cleanDashboardData({
      labels: ["2026-01-01", "2026-01-04"],
      revenue: [100, 160],
      customers: [10, 16],
      conversionRate: [0.02, 0.05],
      churnRate: [0.01, 0.04],
      avgOrderValue: [50, 80],
    });
    expect(out.labels).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ]);
    expect(out.revenue).toEqual([100, 120, 140, 160]);
    expect(out.customers).toEqual([10, 12, 14, 16]);
  });

  it("does not fill gaps larger than 2 missing days", () => {
    const out = cleanDashboardData({
      labels: ["2026-01-01", "2026-01-05"],
      revenue: [100, 200],
      customers: [10, 20],
      conversionRate: [0.02, 0.06],
      churnRate: [0.01, 0.05],
      avgOrderValue: [50, 90],
    });
    expect(out.labels).toEqual(["2026-01-01", "2026-01-05"]);
  });

  it("clamps impossible values into safe ranges", () => {
    const out = cleanDashboardData(
      sample({
        revenue: [-10, 120, 140],
        customers: [-5, 12, 14],
        conversionRate: [-0.4, 1.3, 0.04],
        churnRate: [-1, 4, 0.014],
        avgOrderValue: [-8, 55, 60],
      }),
    );

    expect(out.revenue[0]).toBe(0);
    expect(out.customers[0]).toBe(0);
    expect(out.conversionRate[0]).toBe(0);
    expect(out.conversionRate[1]).toBe(1);
    expect(out.churnRate[0]).toBe(0);
    expect(out.churnRate[1]).toBe(1);
    expect(out.avgOrderValue[0]).toBe(0);
  });
});
