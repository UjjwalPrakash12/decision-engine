"use client";

import { memo, useMemo } from "react";
import { useCountUp } from "@/hooks/useCountUp";
import { useIntersectionReveal } from "@/hooks/useIntersectionReveal";
import { SparkLine } from "@/components/charts/SparkLine";

export type MetricFormat = "integer" | "currency" | "percent1";

export type MetricCardProps = {
  title: string;
  /** Target numeric value for the count-up animation. */
  value: number;
  format?: MetricFormat;
  /** Percentage change for the delta badge (e.g. from day-over-day). */
  delta?: number;
  sparklineData: number[];
  /** Overrides SparkLine auto coloring when set. */
  sparklinePositive?: boolean;
  /** Applies an accent pulse when the metric is in a critical state. */
  critical?: boolean;
  /** Brief plain-language context for why this metric matters now. */
  contextLine?: string;
};

function formatDisplay(n: number, format: MetricFormat): string {
  switch (format) {
    case "currency":
      return "$" + Math.round(n).toLocaleString("en-US");
    case "percent1":
      return `${n.toFixed(1)}%`;
    case "integer":
    default:
      return Math.round(n).toLocaleString("en-US");
  }
}

function MetricCardInner({
  title,
  value,
  format = "integer",
  delta,
  sparklineData,
  sparklinePositive,
  critical = false,
  contextLine,
}: MetricCardProps) {
  const decimals = format === "percent1" ? 1 : 0;
  const { ref, isVisible } = useIntersectionReveal();
  const animated = useCountUp(value, {
    durationMs: 950,
    decimals,
    enabled: isVisible,
  });

  const display = useMemo(
    () => formatDisplay(animated, format),
    [animated, format],
  );

  const isNegative = delta !== undefined && delta < 0;
  const isPositive = delta !== undefined && delta > 0;
  const isFlat = delta === undefined || delta === 0;
  const trendColor = isPositive ? "var(--positive)" : isNegative ? "var(--critical)" : "var(--border)";

  return (
    <div
      ref={ref}
      className="group relative overflow-hidden rounded-xl border p-5 pb-4 transition-all duration-150"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--bg-surface)",
        opacity: isVisible ? 1 : 0,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
          {title}
        </p>
        <SparkLine data={sparklineData} positive={sparklinePositive} />
      </div>

      <div className="flex items-end gap-2">
        <span
          className="text-[32px] font-bold leading-none tracking-[-0.5px] text-[var(--text-primary)]"
          suppressHydrationWarning
        >
          {display}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className="rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums"
          style={{
            background: isPositive
              ? "rgba(16,185,129,0.12)"
              : isNegative
                ? "rgba(239,68,68,0.12)"
                : "rgba(148,163,184,0.12)",
            color: isPositive ? "var(--positive)" : isNegative ? "var(--critical)" : "var(--text-secondary)",
          }}
        >
          {isPositive ? "↑" : isNegative ? "↓" : "→"} {delta !== undefined ? Math.abs(delta) : 0}%
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">vs. previous day</span>
      </div>
      {contextLine ? (
        <p className="mt-1 line-clamp-2 text-[12px] text-[var(--text-muted)]">{contextLine}</p>
      ) : null}
      <div
        className="absolute inset-x-0 bottom-0 h-[2px]"
        style={{ background: critical ? "var(--critical)" : trendColor }}
      />
    </div>
  );
}

export default memo(MetricCardInner);
