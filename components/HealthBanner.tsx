"use client";

import { memo, useMemo } from "react";
import { useDashboard } from "@/context/DashboardContext";

type HealthBannerProps = {
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  lastUpdated?: string;
};

function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function HealthBannerInner({
  criticalCount,
  warningCount,
  infoCount,
  lastUpdated,
}: HealthBannerProps) {
  const { selectedRange } = useDashboard();

  const status = useMemo(() => {
    if (criticalCount > 0) {
      return { label: "AT RISK", color: "var(--critical)", tone: "risk" as const };
    }
    if (warningCount > 0) {
      return { label: "NEEDS ATTENTION", color: "var(--warning)", tone: "warn" as const };
    }
    return { label: "ALL CLEAR", color: "var(--positive)", tone: "healthy" as const };
  }, [criticalCount, warningCount]);

  const statusLine = `${pluralize(criticalCount, "critical issue")} and ${pluralize(
    warningCount,
    "warning",
  )} detected across your last ${selectedRange} days.`;

  const bgByTone =
    status.tone === "risk"
      ? "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, transparent 60%), var(--bg-surface)"
      : status.tone === "warn"
        ? "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, transparent 60%), var(--bg-surface)"
        : "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, transparent 60%), var(--bg-surface)";

  return (
    <section
      className="mb-8 rounded-xl px-7 py-5"
      style={{
        background: bgByTone,
        borderLeft: `3px solid ${status.color}`,
      }}
      aria-label="Current business health status"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: status.color }} />
            <p className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: status.color }}>
              {status.label}
            </p>
          </div>
          <p className="mt-2 text-[16px] font-medium text-[var(--text-primary)]">{statusLine}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <span className="rounded-full border px-3 py-1" style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.2)", color: "var(--critical)" }}>
            Critical: {criticalCount}
          </span>
          <span className="rounded-full border px-3 py-1" style={{ background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.2)", color: "var(--warning)" }}>
            Warnings: {warningCount}
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-[var(--text-secondary)]">
            Info: {infoCount}
          </span>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-[11px] text-[var(--text-muted)]">
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Just now"}
        </p>
        <div className="mt-2 h-[2px] w-full rounded bg-[var(--border-subtle)]">
          <div className="h-full rounded" style={{ width: "100%", background: status.color }} />
        </div>
      </div>
    </section>
  );
}

export const HealthBanner = memo(HealthBannerInner);
