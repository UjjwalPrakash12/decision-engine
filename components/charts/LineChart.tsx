"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createSmoothPathFromPoints, getMinMax } from "./utils";

const THEME = {
  bg: "#0D0D14",
  line: "#CBD5E1",
  grid: "#1E293B",
  textMuted: "#475569",
  alert: "#EF4444",
  positive: "#10B981",
} as const;

const VIEW_W = 520;
const PAD = { top: 14, right: 14, bottom: 28, left: 30 };

export type LineChartProps = {
  data: number[];
  labels: string[];
  color?: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
};

function formatTooltipValue(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatAxis(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function LineChartInner({
  data,
  labels,
  color = THEME.line,
  height = 220,
  showGrid = true,
  showTooltip = true,
}: LineChartProps) {
  const clipId = useId();
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(0);
  const [dashOffset, setDashOffset] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  const innerW = VIEW_W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const rising = useMemo(() => {
    if (data.length < 2) return true;
    const last = data[data.length - 1] ?? 0;
    const lookback = data[Math.max(0, data.length - 8)] ?? data[0] ?? 0;
    return last >= lookback;
  }, [data]);

  const points = useMemo(() => {
    if (data.length === 0) return [];
    const { min, max } = getMinMax(data);
    const range = Math.max(1e-9, max - min);
    return data.map((v, i) => {
      const tX = data.length === 1 ? 0 : i / (data.length - 1);
      const tY = (v - min) / range;
      return {
        x: PAD.left + tX * innerW,
        y: PAD.top + (1 - tY) * innerH,
      };
    });
  }, [data, innerH, innerW]);

  const dPath = useMemo(
    () => (points.length === 0 ? "" : createSmoothPathFromPoints(points)),
    [points],
  );

  useEffect(() => {
    const el = pathRef.current;
    if (!el || !dPath) {
      setPathLen(0);
      setDashOffset(0);
      return;
    }
    const len = el.getTotalLength();
    setPathLen(len);
    setDashOffset(len);
    requestAnimationFrame(() => setDashOffset(0));
  }, [dPath]);

  const onMove = useCallback(
    (clientX: number, svg: SVGSVGElement) => {
      if (!showTooltip || data.length === 0) return;
      const rect = svg.getBoundingClientRect();
      const vx = ((clientX - rect.left) / rect.width) * VIEW_W - PAD.left;
      const n = data.length;
      if (n === 1) {
        setHover(0);
        return;
      }
      const t = Math.max(0, Math.min(1, vx / innerW));
      setHover(Math.round(t * (n - 1)));
    },
    [data.length, innerW, showTooltip],
  );

  const gridLines = useMemo(() => {
    if (!showGrid || data.length === 0) return null;
    const { min, max } = getMinMax(data);
    const lineCount = 4;
    const lines: ReactNode[] = [];
    for (let i = 0; i < lineCount; i++) {
      const t = i / (lineCount - 1);
      const y = PAD.top + innerH * t;
      lines.push(
        <line
          key={`g-${i}`}
          x1={PAD.left}
          x2={VIEW_W - PAD.right}
          y1={y}
          y2={y}
          stroke={THEME.grid}
          opacity={0.65}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />,
      );
      const val = max - (max - min) * t;
      lines.push(
        <text key={`t-${i}`} x={PAD.left - 5} y={y + 4} textAnchor="end" fontSize={10} fill={THEME.textMuted}>
          {formatAxis(val)}
        </text>,
      );
    }
    return lines;
  }, [data, innerH, showGrid]);

  const hoverPoint = hover !== null ? points[hover] : null;
  const hoverLabel = hover !== null ? labels[hover] ?? "" : "";
  const hoverValue = hover !== null ? data[hover] : null;
  const lastDotColor = rising ? THEME.positive : THEME.alert;

  return (
    <div className="relative w-full overflow-hidden rounded-b-xl" style={{ background: THEME.bg, height }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        className="block w-full select-none"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Line chart"
        onMouseMove={(e) => onMove(e.clientX, e.currentTarget)}
        onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) onMove(t.clientX, e.currentTarget);
        }}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} rx={4} />
          </clipPath>
          <linearGradient id={`${clipId}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={THEME.line} stopOpacity="0.10" />
            <stop offset="100%" stopColor={THEME.line} stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines}

        {dPath ? (
          <g clipPath={`url(#${clipId})`}>
            <path
              d={`${dPath} L ${PAD.left + innerW} ${PAD.top + innerH} L ${PAD.left} ${PAD.top + innerH} Z`}
              fill={`url(#${clipId}-area)`}
              pointerEvents="none"
            />
            <path
              ref={pathRef}
              d={dPath}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={pathLen}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)" }}
            />
            {points.map((p, i) => {
              const isLast = i === points.length - 1;
              return (
                <circle
                  key={`dot-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={isLast ? 4 : 3}
                  fill={isLast ? lastDotColor : THEME.line}
                  stroke={THEME.bg}
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              );
            })}
            {points.length > 0 ? (
              <text
                x={points[points.length - 1]!.x}
                y={points[points.length - 1]!.y - 8}
                fontSize={9}
                textAnchor="middle"
                fill={lastDotColor}
              >
                NOW
              </text>
            ) : null}
          </g>
        ) : null}

        {hoverPoint && showTooltip ? (
          <>
            <line
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke={THEME.grid}
              strokeWidth={1}
              opacity={0.6}
            />
          </>
        ) : null}

        {data.map((_, i) => {
          const isLast = i === data.length - 1;
          if (!isLast && i % 5 !== 0) return null;
          const x = PAD.left + (i / Math.max(1, data.length - 1)) * innerW;
          if (!isLast && x > VIEW_W - PAD.right - 18) return null;
          return (
            <text
              key={`x-${i}`}
              x={isLast ? VIEW_W - 4 : x}
              y={height - 6}
              textAnchor={isLast ? "end" : "middle"}
              fontSize={10}
              fill={isLast ? lastDotColor : THEME.textMuted}
            >
              {(labels[i] ?? "").slice(-5)}
            </text>
          );
        })}
      </svg>

      {showTooltip && hoverPoint && hoverValue !== null ? (
        <div
          className="pointer-events-none absolute z-10 rounded-lg px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${(hoverPoint.x / VIEW_W) * 100}%`,
            top: 8,
            transform: "translateX(-50%)",
            background: THEME.bg,
            border: `1px solid ${THEME.grid}`,
            color: "#E2E8F0",
          }}
        >
          <div className="font-semibold tabular-nums" style={{ color: THEME.line }}>
            {formatTooltipValue(hoverValue)}
          </div>
          {hoverLabel ? (
            <div className="mt-0.5 text-[10px]" style={{ color: THEME.textMuted }}>
              {hoverLabel}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const LineChart = memo(LineChartInner);
