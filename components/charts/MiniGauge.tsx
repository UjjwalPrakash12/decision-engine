"use client";

import { memo, useEffect, useId, useState } from "react";

const THEME = {
  card: "#1a1a1a",
  grid: "#2a2a2a",
  track: "#2f2f2f",
  text: "#e5e5e5",
  muted: "#888",
} as const;

/** viewBox width / height */
const VB = 100;
const R = 38;
const CX = 50;
const CY = 52;

/** Semicircle arc: top half, opening downward (gauge shape). */
function describeArc(cx: number, cy: number, r: number): string {
  const lx = cx - r;
  const rx = cx + r;
  return `M ${lx} ${cy} A ${r} ${r} 0 0 1 ${rx} ${cy}`;
}

export type MiniGaugeProps = {
  value: number;
  label: string;
  color?: string;
};

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function MiniGaugeInner({
  value,
  label,
  color = "#d4af37",
}: MiniGaugeProps) {
  const gradId = useId();
  const pct = clampPct(value);
  const pathD = describeArc(CX, CY, R);

  /** Approximate length of semicircle π·r (for stroke-dash animation). */
  const arcLen = Math.PI * R;
  const [offset, setOffset] = useState(arcLen);

  useEffect(() => {
    setOffset(arcLen);
    const target = arcLen * (1 - pct / 100);
    const id = requestAnimationFrame(() => {
      setOffset(target);
    });
    return () => cancelAnimationFrame(id);
  }, [arcLen, pct]);

  return (
    <div
      className="inline-flex flex-col items-center rounded-xl px-3 py-2"
      style={{
        background: THEME.card,
        border: `1px solid ${THEME.grid}`,
        minWidth: 112,
      }}
    >
      <svg
        width={112}
        height={72}
        viewBox={`0 0 ${VB} ${VB * 0.72}`}
        className="block"
        role="img"
        aria-label={`${label}: ${pct}%`}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity={0.85} />
            <stop offset="100%" stopColor={color} stopOpacity={1} />
          </linearGradient>
        </defs>

        <path
          d={pathD}
          fill="none"
          stroke={THEME.track}
          strokeWidth={7}
          strokeLinecap="round"
        />

        <path
          d={pathD}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />

        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          fontSize={15}
          fontWeight={700}
          fill={THEME.text}
          className="tabular-nums"
        >
          {Math.round(pct)}%
        </text>
      </svg>

      <span
        className="mt-0.5 text-center text-[10px] uppercase tracking-wider"
        style={{ color: THEME.muted, maxWidth: 104 }}
      >
        {label}
      </span>
    </div>
  );
}

export const MiniGauge = memo(MiniGaugeInner);
