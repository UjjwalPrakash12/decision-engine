"use client";

import { memo, useMemo } from "react";
import { createPath } from "./utils";

const W = 80;
const H = 32;

const GREEN = "#22c55e";
const RED = "#ef4444";
const NEUTRAL = "#6b7280";

export type SparkLineProps = {
  data: number[];
  /** When true, forces an “up” green stroke regardless of data. */
  positive?: boolean;
};

function detectUpward(data: readonly number[]): boolean {
  if (data.length < 2) return true;
  const first = data[0];
  const last = data[data.length - 1];
  if (last > first) return true;
  if (last < first) return false;
  const mid = data[Math.floor(data.length / 2)];
  return mid >= first;
}

function SparkLineInner({ data, positive }: SparkLineProps) {
  const d = useMemo(
    () => (data.length === 0 ? "" : createPath(data, W, H)),
    [data],
  );

  const stroke = useMemo(() => {
    if (positive === true) return GREEN;
    if (positive === false) return RED;
    return detectUpward(data) ? GREEN : data.length === 0 ? NEUTRAL : RED;
  }, [data, positive]);

  if (data.length === 0) {
    return (
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="shrink-0"
        aria-hidden
      />
    );
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label="Sparkline"
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export const SparkLine = memo(SparkLineInner);
