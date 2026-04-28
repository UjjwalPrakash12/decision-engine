"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import MetricCard from "@/components/MetricCard";
import InsightCard from "@/components/InsightCard";
import ActionCard from "@/components/ActionCard";
import { LineChart } from "@/components/charts/LineChart";
import { BarChart } from "@/components/charts/BarChart";
import { TimeRangeSelector } from "@/components/TimeRangeSelector";
import { Simulator } from "@/components/Simulator";
import { InsightPanel } from "@/components/InsightPanel";
import { ActionPlan } from "@/components/ActionPlan";
import { QueryBar } from "@/components/QueryBar";
import { QueryResult } from "@/components/QueryResult";
import { HealthBanner } from "@/components/HealthBanner";
import { OnboardingToast } from "@/components/OnboardingToast";
import { UploadScreen, ChartLogo } from "@/components/UploadScreen";
import { useDashboard } from "@/context/DashboardContext";
import { DataContext } from "@/context/DataContext";
import {
  RULE_IMPACT_MAP,
  evaluateBusiness,
  getSeverityCount,
  type BusinessResult,
} from "@/lib/ruleEngine";
import { animations } from "@/lib/animations";
import { isInsightDismissedForToday } from "@/lib/insightPanelUtils";
import { sliceDashboardData } from "@/lib/data";

function dayOverDayPct(arr: readonly number[]): number | undefined {
  if (arr.length < 2) return undefined;
  const prev = arr[arr.length - 2];
  const last = arr[arr.length - 1];
  if (prev === 0) return undefined;
  return Math.round(((last - prev) / Math.abs(prev)) * 1000) / 10;
}

function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return `${text.slice(0, n).trim()}…`;
}

function mapImpact(ruleId: string): string {
  const aliases: Record<string, string> = {
    "revenue-7d-slope-negative": "revenue_7day_trend",
    "revenue-below-period-mean": "revenue_vs_average",
    "conversion-rate-week-over-week-down": "conversion_compression",
    "churn-above-two-percent": "elevated_churn",
    "critical-churn-up-revenue-down": "retention_revenue_stress",
  };
  const key = aliases[ruleId] ?? ruleId;
  return RULE_IMPACT_MAP[key] ?? "This issue can compound quickly if left unresolved.";
}

function getMetricContext(
  analysis: BusinessResult[],
): {
  revenue?: string;
  customers?: string;
  conversion?: string;
  churn?: string;
} {
  const revenueRule = analysis.find((r) => r.category === "revenue");
  const customersRule = analysis.find(
    (r) => r.name.toLowerCase().includes("customer") || r.category === "growth",
  );
  const conversionRule = analysis.find((r) =>
    r.name.toLowerCase().includes("conversion"),
  );
  const churnRule = analysis.find((r) => r.name.toLowerCase().includes("churn"));

  return {
    revenue: revenueRule ? truncate(revenueRule.insight, 50) : undefined,
    customers: customersRule ? truncate(customersRule.insight, 50) : undefined,
    conversion: conversionRule ? truncate(conversionRule.insight, 50) : undefined,
    churn: churnRule ? truncate(churnRule.insight, 50) : undefined,
  };
}

function FileBadgeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="#888"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("DashboardPage must be used within DataProvider");
  }
  const { metrics, isLoaded, source, fileName, rowCount, storageWarning, reset } = ctx;

  const { selectedRange } = useDashboard();
  const [now, setNow] = useState(() => new Date());
  const [dismissTick, setDismissTick] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelResult, setPanelResult] = useState<BusinessResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [queryError, setQueryError] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!metrics) return null;
    return sliceDashboardData(metrics, selectedRange);
  }, [metrics, selectedRange]);

  const analysis = useMemo(() => {
    if (!data) return [];
    return evaluateBusiness(data);
  }, [data]);

  const visibleAnalysis = useMemo(
    () => analysis.filter((r) => !isInsightDismissedForToday(r.ruleId)),
    [analysis, dismissTick],
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const severity = useMemo(
    () => getSeverityCount(visibleAnalysis),
    [visibleAnalysis],
  );
  const metricContext = useMemo(() => getMetricContext(visibleAnalysis), [visibleAnalysis]);
  const groupedIssues = useMemo(
    () => ({
      critical: visibleAnalysis.filter((r) => r.severity === "critical"),
      warning: visibleAnalysis.filter((r) => r.severity === "warning"),
      info: visibleAnalysis.filter((r) => r.severity === "info"),
    }),
    [visibleAnalysis],
  );

  const kpis = useMemo(() => {
    if (!data) return null;
    const { revenue, customers, conversionRate, churnRate } = data;
    const lastR = revenue[revenue.length - 1] ?? 0;
    const lastC = customers[customers.length - 1] ?? 0;
    const lastCr = (conversionRate[conversionRate.length - 1] ?? 0) * 100;
    const lastCh = (churnRate[churnRate.length - 1] ?? 0) * 100;

    return {
      revenue: {
        value: lastR,
        delta: dayOverDayPct(revenue),
        spark: [...revenue],
        positive: (revenue[revenue.length - 1] ?? 0) >= (revenue[revenue.length - 2] ?? 0),
        critical: false,
      },
      customers: {
        value: lastC,
        delta: dayOverDayPct(customers),
        spark: [...customers],
        positive: (customers[customers.length - 1] ?? 0) >= (customers[customers.length - 2] ?? 0),
        critical: false,
      },
      conversion: {
        value: lastCr,
        delta: dayOverDayPct(
          conversionRate.map((x) => x * 100),
        ),
        spark: conversionRate.map((x) => x * 100),
        positive: (conversionRate[conversionRate.length - 1] ?? 0) >= (conversionRate[conversionRate.length - 2] ?? 0),
        critical: false,
      },
      churn: {
        value: lastCh,
        delta: dayOverDayPct(churnRate.map((x) => x * 100)),
        spark: churnRate.map((x) => x * 100),
        positive: (churnRate[churnRate.length - 1] ?? 0) <= (churnRate[churnRate.length - 2] ?? Infinity),
        critical: (churnRate[churnRate.length - 1] ?? 0) > 0.02,
      },
    };
  }, [data]);

  const rangeLabel = `${selectedRange}-day`;

  const runQuery = useCallback(
    async (question: string) => {
      setQueryLoading(true);
      setQueryError(null);
      setQueryText("");
      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, timeRange: selectedRange }),
        });
        if (!res.ok || !res.body) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let finalText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          finalText += decoder.decode(value, { stream: true });
          setQueryText(finalText);
        }
      } catch (e) {
        setQueryError(e instanceof Error ? e.message : "Failed to query AI");
      } finally {
        setQueryLoading(false);
      }
    },
    [selectedRange],
  );

  const lastUpdated = useMemo(() => new Date().toISOString(), [metrics]);

  if (!isLoaded || !metrics || !data || !kpis) {
    return <UploadScreen />;
  }

  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const displayName = fileName ? truncate(fileName, 20) : "";

  return (
    <div
      className="min-h-screen text-[var(--text-primary)]"
      style={{
        background:
          "var(--bg-base)",
      }}
    >
      {storageWarning ? (
        <div
          className="sticky top-0 z-40 border-b border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] px-4 py-2 text-center text-[11px] text-[var(--warning)]"
          role="status"
        >
          {storageWarning}
        </div>
      ) : null}

      <header
        className="sticky top-0 z-30 h-[52px] border-b border-[var(--border-subtle)] px-4 sm:px-6"
        style={{ background: "rgba(10,10,15,0.92)", backdropFilter: "blur(16px)" }}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {source === "uploaded" ? (
              <span
                className="flex max-w-[220px] items-center gap-1.5 truncate text-[11px] text-[var(--text-secondary)]"
                title={fileName ?? undefined}
              >
                <FileBadgeIcon />
                <span className="truncate">{displayName || "Your CSV"}</span>
                <span className="shrink-0 text-[var(--text-muted)]">·</span>
                <span className="shrink-0">{rowCount} rows</span>
              </span>
            ) : (
              <span className="text-[11px] italic text-[var(--text-muted)]">Demo data</span>
            )}
            <div className="flex items-center gap-2">
              <ChartLogo className="h-8 w-8 shrink-0" />
              <div>
                <h1 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary)]">
                  Decision Engine
                </h1>
                <p className="text-[10px] tracking-widest text-[var(--text-muted)]">COMMAND CENTER</p>
              </div>
            </div>
            <TimeRangeSelector />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[12px] text-[#666] transition-colors hover:border-[#444] hover:text-[var(--text-secondary)]"
              style={{ padding: "4px 10px", borderRadius: "8px" }}
            >
              ↑ Change data
            </button>
            <div className="text-right">
              <p className="mono-ui text-[15px] font-semibold text-[var(--text-primary)]">{timeStr}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{dateStr}</p>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: "var(--positive)" }}
                />
                <span className="text-[10px] text-[var(--text-muted)]">Live</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6" aria-label="Decision dashboard main content">
        <HealthBanner
          criticalCount={severity.critical}
          warningCount={severity.warning}
          infoCount={severity.info}
          lastUpdated={lastUpdated}
        />

        <section className="space-y-6">
          <div className="grid min-h-[132px] grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Revenue"
              value={kpis.revenue.value}
              format="currency"
              delta={kpis.revenue.delta}
              sparklineData={kpis.revenue.spark}
              sparklinePositive={kpis.revenue.positive}
              contextLine={metricContext.revenue}
            />
            <MetricCard
              title="Customers"
              value={kpis.customers.value}
              format="integer"
              delta={kpis.customers.delta}
              sparklineData={kpis.customers.spark}
              sparklinePositive={kpis.customers.positive}
              contextLine={metricContext.customers}
            />
            <MetricCard
              title="Conversion rate"
              value={kpis.conversion.value}
              format="percent1"
              delta={kpis.conversion.delta}
              sparklineData={kpis.conversion.spark}
              sparklinePositive={kpis.conversion.positive}
              contextLine={metricContext.conversion}
            />
            <MetricCard
              title="Churn rate"
              value={kpis.churn.value}
              format="percent1"
              delta={kpis.churn.delta}
              sparklineData={kpis.churn.spark}
              sparklinePositive={kpis.churn.positive}
              critical={kpis.churn.critical}
              contextLine={metricContext.churn}
            />
          </div>
        </section>

        <section className="space-y-6">
          <div className="grid min-h-[480px] grid-cols-1 gap-6">
            <div
              key={`rev-${selectedRange}`}
              className="min-h-[260px] rounded-xl border border-[var(--border-subtle)] p-5 will-change-transform"
              style={{ background: "var(--bg-surface)", animation: animations.fadeInUp }}
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Revenue · {rangeLabel.toUpperCase()}
              </p>
              <LineChart
                data={data.revenue}
                labels={data.labels}
                height={220}
                showGrid
                showTooltip
              />
            </div>
            <div
              key={`cust-${selectedRange}`}
              className="min-h-[220px] rounded-xl border border-[var(--border-subtle)] p-5 will-change-transform"
              style={{ background: "var(--bg-surface)", animation: animations.fadeInUp }}
            >
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Customers · {rangeLabel.toUpperCase()}
              </p>
              <BarChart
                data={data.customers}
                labels={data.labels}
                colorFn={(_v, i) =>
                  i === data.customers.length - 1 &&
                  (data.customers[data.customers.length - 1] ?? 0) <
                    (data.customers[data.customers.length - 2] ?? 0)
                    ? "var(--critical)"
                    : "var(--accent)"
                }
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[20px] font-semibold text-[var(--text-primary)]">What went wrong</h2>
            <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              {visibleAnalysis.length} detected
            </span>
          </div>

          {visibleAnalysis.length === 0 ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-[13px] text-[var(--text-muted)]">
              No issues detected. Metrics look stable.
            </div>
          ) : (
            <div className="space-y-4">
              {(
                [
                  ["critical", groupedIssues.critical, "var(--critical)", "Critical"],
                  ["warning", groupedIssues.warning, "var(--warning)", "Warnings"],
                  ["info", groupedIssues.info, "var(--accent-light)", "Info"],
                ] as const
              ).map(([key, list, color, label]) =>
                list.length ? (
                  <div key={key} className="space-y-3">
                    <div
                      className="sticky top-[76px] z-10 flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
                      style={{ background: "rgba(20,20,20,0.95)", backdropFilter: "blur(8px)" }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                      <span style={{ color }}>{label}</span>
                    </div>
                    {list.map((r, i) => (
                      <InsightCard
                        key={r.ruleId}
                        insight={r.insight}
                        index={i}
                        severity={r.severity}
                        whyLine={mapImpact(r.ruleId)}
                        onClick={() => {
                          setPanelResult(r);
                          setPanelOpen(true);
                        }}
                      />
                    ))}
                  </div>
                ) : null,
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col items-center">
          <div className="h-8 w-px bg-gradient-to-b from-[var(--border-subtle)] to-[var(--accent)]" />
          <span className="rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
            leads to
          </span>
          <div className="h-8 w-px bg-gradient-to-b from-[var(--accent)] to-[var(--border-subtle)]" />
        </div>

        <section className="space-y-4">
                    <h2 className="text-[20px] font-semibold text-[var(--text-primary)]">What to do now</h2>
          <p className="text-[13px] text-[var(--text-muted)]">Prioritized by business impact.</p>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            {visibleAnalysis.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-muted)]">No actions required.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {visibleAnalysis.map((r, i) => (
                  <ActionCard
                    key={r.ruleId}
                    action={r.action}
                    index={i}
                    linkedInsight={r.insight}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="my-10 flex items-center gap-3">
          <div className="h-px flex-1 border-t border-dashed border-[var(--border)]" />
          <span className="text-[11px] text-[var(--text-muted)]"></span>
          <div className="h-px flex-1 border-t border-dashed border-[var(--border)]" />
        </div>

        <section className="rounded-2xl border border-[var(--border-subtle)] p-1" style={{ background: "#141414" }}>
          <Simulator data={data} baselineAnalysis={analysis} />
        </section>

        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 border-t border-dashed border-[var(--border)]" />
          <span className="text-[11px] text-[var(--text-muted)]"></span>
          <div className="h-px flex-1 border-t border-dashed border-[var(--border)]" />
        </div>

        <section className="space-y-5 rounded-2xl border border-[var(--border)] p-5 sm:p-6" style={{ background: "#151515" }}>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
            <div>
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">AI-powered analysis</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Generate structured action plans and ask natural language questions.
              </p>
            </div>
          </div>
          <ActionPlan results={visibleAnalysis} timeRange={selectedRange} />
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Ask the dashboard</h2>
            <QueryBar onSubmit={runQuery} loading={queryLoading} />
            <QueryResult text={queryText} loading={queryLoading} error={queryError} />
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-8 max-w-6xl border-t border-[var(--border-subtle)] px-4 py-8 text-xs text-[var(--text-muted)] sm:px-6">
        Decision Engine Dashboard — Analyze. Understand. Act.
      </footer>

      <InsightPanel
        open={panelOpen}
        result={panelResult}
        data={data}
        onClose={() => {
          setPanelOpen(false);
          setPanelResult(null);
        }}
        onDismissedToday={() => setDismissTick((n) => n + 1)}
      />
      <OnboardingToast />
    </div>
  );
}
