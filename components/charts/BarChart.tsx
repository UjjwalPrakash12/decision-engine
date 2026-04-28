"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { getMinMax } from "./utils";

const THEME = {
  bg: "#0D0D14",
  grid: "#1E293B",
  textMuted: "#475569",
  barBase: "#475569",
  barMid: "#64748B",
  barRecent: "#94A3B8",
  barHighlight: "#3B82F6",
  barAlert: "#EF4444",
} as const;

const VIEW_W = 520;
const VIEW_H = 180;
const PAD = { top: 12, right: 14, bottom: 24, left: 30 };

export type BarChartProps = {
  data: number[];
  labels: string[];
  colorFn?: (val: number, i: number) => string;
  showValues?: boolean;
};

function rollingAvg7(data: number[], i: number): number {
  const start = Math.max(0, i - 6);
  const window = data.slice(start, i + 1);
  if (window.length === 0) return data[i] ?? 0;
  return window.reduce((a, b) => a + b, 0) / window.length;
}

function zoneColor(i: number): string {
  if (i <= 13) return THEME.barBase;
  if (i <= 22) return THEME.barMid;
  return THEME.barRecent;
}

function BarChartInner({ data, labels }: BarChartProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    setAnimateIn(false);
    const id = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(id);
  }, [data]);

  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = VIEW_H - PAD.top - PAD.bottom;

  const maxVal = useMemo(() => (data.length ? getMinMax(data).max : 1), [data]);

  const n = Math.max(1, data.length);
  const columnWidth = innerW / n;
  const barWidth = columnWidth * 0.55;
  const xInset = columnWidth * 0.225;
  const baseY = PAD.top + innerH;

  const gridLines = useMemo(() => {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const y = PAD.top + innerH * t;
      out.push(
        <line
          key={`g-${i}`}
          x1={PAD.left}
          x2={VIEW_W - PAD.right}
          y1={y}
          y2={y}
          stroke={THEME.grid}
          opacity={0.65}
          strokeWidth={1}
        />,
      );
    }
    return out;
  }, [innerH]);

  return (
    <div className="w-full overflow-hidden rounded-b-xl" style={{ background: THEME.bg, height: VIEW_H }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block w-full select-none"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Bar chart"
      >
        <defs>
          {data.map((_, i) => (
            <linearGradient key={`grad-${i}`} id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              {i === data.length - 1 ? (
                <>
                  <stop offset="0%" stopColor={THEME.barHighlight} />
                  <stop offset="100%" stopColor="rgba(59,130,246,0.35)" />
                </>
              ) : (data[i] ?? 0) < rollingAvg7(data, i) ? (
                <>
                  <stop offset="0%" stopColor={THEME.barAlert} stopOpacity="0.75" />
                  <stop offset="100%" stopColor={THEME.barAlert} stopOpacity="0.20" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor={zoneColor(i)} stopOpacity="0.95" />
                  <stop offset="100%" stopColor={zoneColor(i)} stopOpacity="0.7" />
                </>
              )}
            </linearGradient>
          ))}
        </defs>

        {gridLines}

        {data.map((val, i) => {
          const targetH = maxVal > 0 ? (val / maxVal) * innerH : 0;
          const h = animateIn ? targetH : 0;
          const x = PAD.left + i * columnWidth + xInset;
          const y = baseY - h;
          const isLast = i === data.length - 1;
          const declining = val < rollingAvg7(data, i);
          const dim = hover !== null && hover !== i ? 0.55 : 1;

          return (
            <g key={i} opacity={dim}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={2}
                ry={2}
                fill={`url(#bar-grad-${i})`}
                style={{
                  transition:
                    "y 620ms cubic-bezier(0.34,1.2,0.64,1), height 620ms cubic-bezier(0.34,1.2,0.64,1), opacity 120ms ease",
                }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {h > 0 ? (
                <line
                  x1={x}
                  x2={x + barWidth}
                  y1={y}
                  y2={y}
                  stroke={isLast ? THEME.barHighlight : declining ? THEME.barAlert : zoneColor(i)}
                  strokeOpacity={isLast || declining ? 0.75 : 0.35}
                  strokeWidth={1.5}
                />
              ) : null}
            </g>
          );
        })}

        {data.map((_, i) => {
          const isLast = i === data.length - 1;
          if (!isLast && i % 5 !== 0) return null;
          const x = PAD.left + i * columnWidth + columnWidth * 0.5;
          if (!isLast && x > VIEW_W - PAD.right - 18) return null;
          return (
            <text
              key={`lbl-${i}`}
              x={isLast ? VIEW_W - 4 : x}
              y={VIEW_H - 6}
              textAnchor={isLast ? "end" : "middle"}
              fontSize={10}
              fill={isLast ? THEME.barHighlight : THEME.textMuted}
            >
              {isLast ? "today" : (labels[i] ?? "").slice(-5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export const BarChart = memo(BarChartInner);
