"use client";

import { memo } from "react";
import { useDashboard, type TimeRange } from "@/context/DashboardContext";

const RANGES: { value: TimeRange; label: string }[] = [
  { value: 7, label: "7D" },
  { value: 14, label: "14D" },
  { value: 30, label: "30D" },
];

function TimeRangeSelectorInner() {
  const { selectedRange, setSelectedRange } = useDashboard();

  return (
    <div
      role="tablist"
      aria-label="Time range"
      className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-1"
    >
      {RANGES.map(({ value, label }) => {
        const selected = selectedRange === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-range-${value}`}
            aria-selected={selected}
            aria-controls={`panel-dashboard-${value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => setSelectedRange(value)}
            className="min-w-[3.25rem] rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors"
            style={{
              background: selected ? "var(--bg-card)" : "transparent",
              color: selected ? "var(--accent-light)" : "var(--text-muted)",
              borderColor: selected ? "rgba(99,102,241,0.4)" : "var(--border)",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export const TimeRangeSelector = memo(TimeRangeSelectorInner);
