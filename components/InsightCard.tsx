"use client";

import { memo } from "react";

export type InsightCardProps = {
  insight: string;
  index: number;
  whyLine?: string;
  severity?: "info" | "warning" | "critical";
  onClick?: () => void;
};

function InsightCardInner({
  insight,
  index,
  whyLine,
  severity = "warning",
  onClick,
}: InsightCardProps) {
  const palette =
    severity === "critical"
      ? {
          accent: "var(--critical)",
          badgeBg: "rgba(239,68,68,0.15)",
          label: "Critical",
        }
      : severity === "info"
        ? {
            accent: "var(--accent-light)",
            badgeBg: "rgba(129,140,248,0.15)",
            label: "Info",
          }
        : {
            accent: "var(--warning)",
            badgeBg: "rgba(245,158,11,0.12)",
            label: "Warning",
          };

  const interactive = Boolean(onClick);

  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ background: palette.badgeBg, color: palette.accent }}
        >
          {palette.label}
        </span>
      </div>
      <p className="mt-2 text-[14px] leading-[1.5] text-[var(--text-primary)]">{insight}</p>
      <div className="mt-3 border-t border-[var(--border-subtle)] pt-2">
        <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-muted)]">Why this matters</p>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          {whyLine ?? "Track this signal closely to avoid compounding impact."}
        </p>
      </div>
      <div className="sr-only">{index}</div>
      {!whyLine ? null : (
        <div className="sr-only">{whyLine}</div>
      )}
    </>
  );

  const sharedClass =
    "relative w-full rounded-[10px] border border-[var(--border-subtle)] border-l-[3px] bg-[var(--bg-surface)] p-4 text-left";

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={sharedClass}
        style={{ borderLeftColor: palette.accent }}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={sharedClass} style={{ borderLeftColor: palette.accent }}>
      {inner}
    </div>
  );
}

export default memo(InsightCardInner);
