"use client";

import { memo, useCallback, useMemo, useState } from "react";
import type { DashboardData } from "@/lib/data";
import {
  evaluateBusiness,
  getSeverityCount,
  type BusinessResult,
} from "@/lib/ruleEngine";
import {
  applyScenario,
  cloneDashboardData,
  type ScenarioParams,
} from "@/lib/simulator";
import { cleanDashboardData } from "@/lib/preprocessMetrics";

export type SimulatorProps = {
  data: DashboardData;
  baselineAnalysis: BusinessResult[];
};

function dayOverDayPct(arr: readonly number[]): number | undefined {
  if (arr.length < 2) return undefined;
  const prev = arr[arr.length - 2];
  const last = arr[arr.length - 1];
  if (prev === 0) return undefined;
  return Math.round(((last - prev) / Math.abs(prev)) * 1000) / 10;
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  suffix,
  display,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix: string;
  /** Pre-formatted value text (include your own +/-). */
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </span>
        <span className="tabular-nums text-xs font-bold text-[var(--accent-light)]">
          {display}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sim-slider h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--border)] accent-[var(--accent-light)]"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />
    </div>
  );
}

function lastKpis(d: DashboardData) {
  const n = d.revenue.length;
  if (n === 0) {
    return { rev: 0, cust: 0, conv: 0, churn: 0 };
  }
  return {
    rev: d.revenue[n - 1] ?? 0,
    cust: d.customers[n - 1] ?? 0,
    conv: (d.conversionRate[n - 1] ?? 0) * 100,
    churn: (d.churnRate[n - 1] ?? 0) * 100,
  };
}

function diffSummary(
  base: BusinessResult[],
  sim: BusinessResult[],
): { text: string } {
  const b = getSeverityCount(base);
  const s = getSeverityCount(sim);
  const newCritical = Math.max(0, s.critical - b.critical);
  const newWarnings = Math.max(0, s.warning - b.warning);
  const newInfo = Math.max(0, s.info - b.info);
  const parts: string[] = [];
  if (newCritical) parts.push(`${newCritical} new critical alert(s)`);
  if (newWarnings) parts.push(`${newWarnings} new warning(s)`);
  if (newInfo) parts.push(`${newInfo} new info alert(s)`);
  const ruleDelta = sim.length - base.length;
  const ruleNote =
    ruleDelta > 0
      ? `${ruleDelta} more rule(s) firing than baseline`
      : ruleDelta < 0
        ? `${Math.abs(ruleDelta)} fewer rule(s) than baseline`
        : "Same number of firing rules as baseline";
  const text =
    parts.length > 0 ? `${parts.join("; ")}. ${ruleNote}.` : `${ruleNote}.`;
  return { text };
}

function SimulatorInner({ data, baselineAnalysis }: SimulatorProps) {
  const [open, setOpen] = useState(false);
  const [revenuePct, setRevenuePct] = useState(0);
  const [customerPct, setCustomerPct] = useState(0);
  const [convPp, setConvPp] = useState(0);
  const [churnPp, setChurnPp] = useState(0);
  const [compare, setCompare] = useState(false);

  const params: ScenarioParams = useMemo(
    () => ({
      revenuePct,
      customerPct,
      conversionPp: convPp,
      churnPp: churnPp,
    }),
    [revenuePct, customerPct, convPp, churnPp],
  );

  const simulatedData = useMemo(() => {
    return applyScenario(cloneDashboardData(data), params);
  }, [data, params]);

  const simulatedAnalysis = useMemo(
    () => evaluateBusiness(cleanDashboardData(simulatedData)),
    [simulatedData],
  );

  const diff = useMemo(
    () => diffSummary(baselineAnalysis, simulatedAnalysis),
    [baselineAnalysis, simulatedAnalysis],
  );

  const baseK = useMemo(() => lastKpis(data), [data]);
  const simK = useMemo(() => lastKpis(simulatedData), [simulatedData]);

  const reset = useCallback(() => {
    setRevenuePct(0);
    setCustomerPct(0);
    setConvPp(0);
    setChurnPp(0);
  }, []);

  const isDirty =
    revenuePct !== 0 ||
    customerPct !== 0 ||
    convPp !== 0 ||
    churnPp !== 0;

  return (
    <section
      className="rounded-2xl border border-[var(--border)]"
      style={{ background: "var(--bg-surface)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--border-subtle)]"
        aria-expanded={open}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            What-if
          </p>
          <h3 className="text-sm font-bold text-[var(--accent-light)]">
            Scenario Simulator — test what happens if…
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Adjust business variables to preview how insights would change.
          </p>
        </div>
        <span className="text-lg text-[var(--text-secondary)]" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="space-y-6 border-t border-[var(--border)] px-5 pb-6 pt-4">
          <div className="grid gap-5 md:grid-cols-2">
            <SliderRow
              label="Revenue change"
              min={-50}
              max={50}
              step={1}
              value={revenuePct}
              suffix="%"
              display={`${revenuePct > 0 ? "+" : ""}${revenuePct}`}
              onChange={setRevenuePct}
            />
            <SliderRow
              label="Customer change"
              min={-50}
              max={50}
              step={1}
              value={customerPct}
              suffix="%"
              display={`${customerPct > 0 ? "+" : ""}${customerPct}`}
              onChange={setCustomerPct}
            />
            <SliderRow
              label="Conversion change"
              min={-2}
              max={2}
              step={0.1}
              value={convPp}
              suffix=" pp"
              display={`${convPp > 0 ? "+" : ""}${convPp.toFixed(1)}`}
              onChange={setConvPp}
            />
            <SliderRow
              label="Churn change"
              min={-2}
              max={2}
              step={0.1}
              value={churnPp}
              suffix=" pp"
              display={`${churnPp > 0 ? "+" : ""}${churnPp.toFixed(1)}`}
              onChange={setChurnPp}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reset}
              disabled={!isDirty}
              className="rounded-lg border border-[#333] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] transition-colors enabled:hover:border-[var(--accent-light)] enabled:hover:text-[var(--accent-light)] disabled:opacity-40"
              style={{ background: "var(--bg-base)" }}
            >
              Reset
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
                className="accent-[var(--accent-light)]"
              />
              Compare real vs simulated
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className="rounded-xl border border-[var(--border)] p-4"
              style={{ background: "var(--bg-base)" }}
            >
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Simulated KPIs (latest day)
              </p>
              {compare ? (
                <dl className="space-y-2 text-xs">
                  {(
                    [
                      ["Revenue", baseK.rev, simK.rev, "usd"] as const,
                      ["Customers", baseK.cust, simK.cust, "int"] as const,
                      ["Conv %", baseK.conv, simK.conv, "pct"] as const,
                      ["Churn %", baseK.churn, simK.churn, "pct"] as const,
                    ] as const
                  ).map(([label, b, s, fmt]) => (
                    <div key={label} className="flex justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 last:border-0">
                      <dt className="text-[var(--text-secondary)]">{label}</dt>
                      <dd className="text-right tabular-nums">
                        <span className="text-[var(--text-muted)]">
                          {fmt === "usd"
                            ? `$${Math.round(b).toLocaleString()}`
                            : fmt === "int"
                              ? Math.round(b).toLocaleString()
                              : `${b.toFixed(1)}%`}
                        </span>
                        <span className="mx-1 text-[#444]">→</span>
                        <span style={{ color: "var(--accent-light)" }}>
                          {fmt === "usd"
                            ? `$${Math.round(s).toLocaleString()}`
                            : fmt === "int"
                              ? Math.round(s).toLocaleString()
                              : `${s.toFixed(1)}%`}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <ul className="space-y-2 text-sm tabular-nums" style={{ color: "var(--accent-light)" }}>
                  <li>Revenue: ${Math.round(simK.rev).toLocaleString()}</li>
                  <li>Customers: {Math.round(simK.cust).toLocaleString()}</li>
                  <li>Conversion: {simK.conv.toFixed(1)}%</li>
                  <li>Churn: {simK.churn.toFixed(1)}%</li>
                </ul>
              )}
            </div>

            <div
              className="rounded-xl border border-[var(--border)] p-4"
              style={{ background: "var(--bg-base)" }}
            >
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Diff summary
              </p>
              <p className="text-sm leading-relaxed text-[#aaa]">{diff.text}</p>
              {getSeverityCount(simulatedAnalysis).critical >
                getSeverityCount(baselineAnalysis).critical && (
                <p className="mt-2 text-xs font-semibold text-red-400">
                  New critical alert(s) vs baseline
                </p>
              )}
              <p className="mt-3 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                Δ day-over-day (simulated)
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Rev Δ {dayOverDayPct(simulatedData.revenue) ?? "—"}% · Cust Δ{" "}
                {dayOverDayPct(simulatedData.customers) ?? "—"}%
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Simulated insights
            </p>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {simulatedAnalysis.length === 0 ? (
                <li className="text-[var(--text-muted)]">No rules firing for this scenario.</li>
              ) : (
                simulatedAnalysis.map((r) => (
                  <li
                    key={r.ruleId}
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                    style={{ background: "var(--bg-base)" }}
                  >
                    <span className="font-semibold text-[var(--text-primary)]">{r.name}</span>
                    <span className="ml-2 text-[10px] uppercase text-[var(--text-secondary)]">
                      {r.severity}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

export const Simulator = memo(SimulatorInner);
