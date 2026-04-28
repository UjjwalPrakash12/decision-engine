import type { DashboardData } from "@/lib/data";
import type { BusinessResult } from "@/lib/ruleEngine";

/** Split recommended action into checklist rows. */
export function parseActionChecklist(action: string): string[] {
  const trimmed = action.trim();
  if (!trimmed) return [];
  const bySemi = trimmed.split(/\s*;\s*/).filter(Boolean);
  if (bySemi.length > 1) return bySemi;
  const bySentence = trimmed.split(/\.\s+/).filter(Boolean);
  if (bySentence.length > 1) {
    return bySentence.map((s) => (s.endsWith(".") ? s : `${s}.`));
  }
  return [trimmed];
}

/** Deterministic “times triggered” mock from rule id. */
export function mockMonthlyTriggerCount(ruleId: string): number {
  let h = 0;
  for (let i = 0; i < ruleId.length; i++) {
    h = (h + ruleId.charCodeAt(i) * (i + 3)) % 12;
  }
  return h + 3;
}

export function getSeriesForInsight(
  result: BusinessResult,
  data: DashboardData,
): number[] {
  const id = result.ruleId.toLowerCase();
  if (id.includes("churn") || result.category === "retention") {
    return data.churnRate.map((x) => x * 100);
  }
  if (id.includes("conversion") || id.includes("customer")) {
    if (id.includes("conversion")) {
      return data.conversionRate.map((x) => x * 100);
    }
    return [...data.customers];
  }
  if (id.includes("revenue") || id.includes("volatility") || result.category === "revenue") {
    return [...data.revenue];
  }
  if (result.category === "efficiency") {
    return [...data.avgOrderValue];
  }
  return [...data.revenue];
}

export function buildTriggerExplanation(
  result: BusinessResult,
  data: DashboardData,
): string {
  const n = data.revenue.length;
  if (n < 2) return result.insight;

  const firstR = data.revenue[0] ?? 0;
  const lastR = data.revenue[n - 1] ?? 0;
  const revPct =
    firstR !== 0
      ? Math.round(((lastR - firstR) / Math.abs(firstR)) * 1000) / 10
      : 0;

  const firstC = data.customers[0] ?? 0;
  const lastC = data.customers[n - 1] ?? 0;
  const custPct =
    firstC !== 0
      ? Math.round(((lastC - firstC) / Math.abs(firstC)) * 1000) / 10
      : 0;

  const id = result.ruleId;

  if (id.includes("revenue-7d") || id.includes("slope")) {
    return `Trailing window: revenue trend vs prior days in this ${n}-day view. Approx. ${revPct}% change from first to last day in the chart.`;
  }
  if (id.includes("below-period") || id.includes("mean")) {
    return `Latest daily revenue vs mean of this window: about ${revPct}% head-to-tail move across displayed days.`;
  }
  if (id.includes("customer")) {
    return `Customer counts shifted roughly ${custPct}% from the first to the last day in this range.`;
  }
  if (id.includes("conversion")) {
    const a = (data.conversionRate[0] ?? 0) * 100;
    const b = (data.conversionRate[n - 1] ?? 0) * 100;
    return `Conversion moved from ~${a.toFixed(1)}% to ~${b.toFixed(1)}% over the selected window.`;
  }
  if (id.includes("churn")) {
    const a = (data.churnRate[0] ?? 0) * 100;
    const b = (data.churnRate[n - 1] ?? 0) * 100;
    return `Churn rate from ~${a.toFixed(1)}% to ~${b.toFixed(1)}% across this period.`;
  }
  if (id.includes("critical-churn")) {
    return `Compound signal: churn slope rising while revenue slope falls in the latest 7-day slice of this view.`;
  }
  return result.insight;
}

const DISMISS_STORAGE_KEY = "de-insight-dismiss-dates";

export function dismissInsightForToday(ruleId: string): void {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY);
    const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[ruleId] = today;
    sessionStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / parse */
  }
}

export function isInsightDismissedForToday(ruleId: string): boolean {
  if (typeof window === "undefined") return false;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[ruleId] === today;
  } catch {
    return false;
  }
}

const CHECKLIST_PREFIX = "de-insight-checklist-";

export function loadChecklistState(ruleId: string, len: number): boolean[] {
  if (typeof window === "undefined") return Array(len).fill(false);
  try {
    const raw = localStorage.getItem(CHECKLIST_PREFIX + ruleId);
    if (!raw) return Array(len).fill(false);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return Array(len).fill(false);
    return Array.from({ length: len }, (_, i) => Boolean(parsed[i]));
  } catch {
    return Array(len).fill(false);
  }
}

export function saveChecklistState(ruleId: string, checked: boolean[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHECKLIST_PREFIX + ruleId, JSON.stringify(checked));
  } catch {
    /* ignore */
  }
}
