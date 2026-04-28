"use client";

import { useEffect, useState } from "react";

function easeOutCubic(t: number): number {
  const p = 1 - t;
  return 1 - p * p * p;
}

export type UseCountUpOptions = {
  /** Total animation length in milliseconds. */
  durationMs?: number;
  /** Decimal places for the output number. */
  decimals?: number;
  /** When false, value stays at 0 (e.g. until intersecting). */
  enabled?: boolean;
};

/**
 * Animates a numeric display from 0 toward `end` using `requestAnimationFrame`.
 * Restarts when `end` or `enabled` changes.
 */
export function useCountUp(
  end: number,
  { durationMs = 900, decimals = 0, enabled = true }: UseCountUpOptions = {},
): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled || !Number.isFinite(end)) {
      setValue(0);
      return;
    }

    let startTime: number | null = null;
    let raf = 0;

    const step = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      const next = end * eased;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(step);
      else setValue(end);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [end, durationMs, enabled]);

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
