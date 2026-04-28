/**
 * Shared math for SVG charts (no external deps).
 */

export function getMinMax(data: readonly number[]): { min: number; max: number } {
  if (data.length === 0) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const v of data) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.01;
    return { min: min - pad, max: max + pad };
  }
  return { min, max };
}

/**
 * Maps each value to a y-coordinate in [0, height]:
 * larger values → smaller y (top of chart in SVG coordinates).
 */
export function normalizeData(data: readonly number[], height: number): number[] {
  if (data.length === 0) return [];
  const { min, max } = getMinMax(data);
  const range = max - min || 1;
  return data.map((v) => height - ((v - min) / range) * height);
}

/**
 * Straight polyline path (M / L) in chart coordinates.
 * x spans [0, width]; y from normalizeData.
 */
export function createPath(
  data: readonly number[],
  width: number,
  height: number,
): string {
  if (data.length === 0) return "";
  const ys = normalizeData(data, height);
  const n = data.length;
  if (n === 1) {
    const y = ys[0];
    return `M 0 ${y} L ${width} ${y}`;
  }
  return ys
    .map((y, i) => {
      const x = (i / (n - 1)) * width;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export type Point2 = { x: number; y: number };

/** Evenly-spaced x, normalized y in a [0,w]×[0,h] chart box (before any padding). */
export function buildChartPoints(
  data: readonly number[],
  width: number,
  height: number,
): Point2[] {
  if (data.length === 0) return [];
  const ys = normalizeData(data, height);
  const n = data.length;
  if (n === 1) return [{ x: width / 2, y: ys[0] }];
  return ys.map((y, i) => ({
    x: (i / (n - 1)) * width,
    y,
  }));
}

/**
 * Smooth cubic Bézier path through the same points as {@link createPath},
 * using simple cardinal-style control points (tension 0.5).
 */
export function createSmoothPath(
  data: readonly number[],
  width: number,
  height: number,
): string {
  return createSmoothPathFromPoints(buildChartPoints(data, width, height));
}

/**
 * Smooth path through explicit pixel coordinates (e.g. after padding offset).
 */
export function createSmoothPathFromPoints(pts: readonly Point2[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }

  const tension = 0.5;
  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;

    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}
