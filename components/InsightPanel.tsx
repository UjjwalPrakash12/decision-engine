"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { DashboardData } from "@/lib/data";
import type { BusinessResult } from "@/lib/ruleEngine";
import { SparkLine } from "@/components/charts/SparkLine";
import {
  buildTriggerExplanation,
  dismissInsightForToday,
  getSeriesForInsight,
  loadChecklistState,
  mockMonthlyTriggerCount,
  parseActionChecklist,
  saveChecklistState,
} from "@/lib/insightPanelUtils";
import { useExplain } from "@/hooks/useExplain";

export type InsightPanelProps = {
  open: boolean;
  result: BusinessResult | null;
  data: DashboardData | null;
  onClose: () => void;
  onDismissedToday: () => void;
};

function severityIcon(sev: BusinessResult["severity"]): string {
  if (sev === "critical") return "🔴";
  if (sev === "warning") return "⚠";
  return "ℹ";
}

function InsightPanelInner({
  open,
  result,
  data,
  onClose,
  onDismissedToday,
}: InsightPanelProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const [checklist, setChecklist] = useState<boolean[]>([]);
  const [slideIn, setSlideIn] = useState(false);
  const { explanation: aiExplanation, isLoading: aiLoading, error: aiError, explain, reset } = useExplain();

  const items = useMemo(
    () => (result ? parseActionChecklist(result.action) : []),
    [result],
  );

  useEffect(() => {
    if (!result) {
      setChecklist([]);
      reset();
      return;
    }
    setChecklist(loadChecklistState(result.ruleId, items.length));
    const key = `decision-engine:explain:${result.ruleId}`;
    const cached = sessionStorage.getItem(key);
    if (cached) {
      void Promise.resolve().then(() => {
        reset();
      });
    } else {
      reset();
    }
  }, [result, items.length]);

  const series = useMemo(() => {
    if (!result || !data) return [];
    return getSeriesForInsight(result, data);
  }, [result, data]);

  const explanation = useMemo(() => {
    if (!result || !data) return "";
    return buildTriggerExplanation(result, data);
  }, [result, data]);

  const triggerCount = result ? mockMonthlyTriggerCount(result.ruleId) : 0;

  useEffect(() => {
    if (!open || !result) {
      setSlideIn(false);
      return;
    }
    setSlideIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSlideIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [open, result?.ruleId]);

  const toggleItem = useCallback(
    (index: number) => {
      if (!result) return;
      setChecklist((prev) => {
        const next = [...prev];
        next[index] = !next[index];
        saveChecklistState(result.ruleId, next);
        return next;
      });
    },
    [result],
  );

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const root = panelRef.current;

    const getFocusable = (): HTMLElement[] => {
      const sel = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      return Array.from(sel);
    };

    const t = window.setTimeout(() => {
      getFocusable()[0]?.focus();
    }, 20);

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = getFocusable();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last?.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onTab);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onTab);
    };
  }, [open, result?.ruleId]);

  if (!open || !result || !data) return null;

  const aiCacheKey = `decision-engine:explain:${result.ruleId}`;
  const cachedExplanation = typeof window !== "undefined" ? sessionStorage.getItem(aiCacheKey) ?? "" : "";
  const displayedExplanation = aiExplanation || cachedExplanation;

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-end"
      role="presentation"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full max-w-full flex-col border-l border-[#2a2a2a] shadow-2xl outline-none"
        style={{
          width: "min(100%, 420px)",
          background: "#0f0f0f",
          transform: slideIn ? "translateX(0)" : "translateX(100%)",
          transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-3 border-b border-[#2a2a2a] px-5 py-4"
          style={{ background: "#1a1a1a" }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#555]">
              Insight detail
            </p>
            <h2 id={titleId} className="mt-1 text-sm font-bold leading-snug text-[#e5e5e5]">
              <span className="mr-2" aria-hidden>
                {severityIcon(result.severity)}
              </span>
              {result.name}
            </h2>
            <span
              className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "rgba(212,175,55,0.12)",
                color: "#d4af37",
                border: "1px solid rgba(212,175,55,0.25)",
              }}
            >
              {result.category}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-[#333] px-2.5 py-1 text-xs text-[#888] transition-colors hover:border-[#d4af37] hover:text-[#d4af37]"
            style={{ background: "#0f0f0f" }}
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <section className="mb-6">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#555]">
              Severity
            </h3>
            <p className="text-sm text-[#c0c0c0]">
              <span className="mr-2" aria-hidden>
                {severityIcon(result.severity)}
              </span>
              <span className="capitalize">{result.severity}</span>
            </p>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#555]">
              Trigger context
            </h3>
            <p className="text-sm leading-relaxed text-[#aaa]">{explanation}</p>
          </section>

          <section className="mb-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#555]">
                AI explainer
              </h3>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await explain({
                      insight: result.insight,
                      severity: result.severity,
                      metrics: {
                        revenue: data.revenue,
                        customers: data.customers,
                      },
                    });
                    sessionStorage.setItem(aiCacheKey, text);
                  } catch {
                    // handled by hook error state
                  }
                }}
                disabled={aiLoading}
                className="rounded-lg border border-[#333] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#888] transition-colors hover:border-[#d4af37] hover:text-[#d4af37] disabled:opacity-60"
                style={{ background: "#0f0f0f" }}
              >
                {aiLoading ? "Generating..." : "Ask AI to explain"}
              </button>
            </div>
            <div className="rounded-xl border border-[#2a2a2a] p-3 text-sm leading-relaxed" style={{ background: "#151515", color: "#bbb" }}>
              {aiError ? (
                <p className="text-red-400">{aiError}</p>
              ) : displayedExplanation ? (
                <p>{displayedExplanation}</p>
              ) : (
                <p className="text-[#666]">Generate an explanation for this insight.</p>
              )}
            </div>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#555]">
              Related trend
            </h3>
            <div
              className="flex items-center justify-center rounded-xl border border-[#2a2a2a] py-4"
              style={{ background: "#1a1a1a" }}
            >
              <SparkLine data={series} />
            </div>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#555]">
              Action checklist
            </h3>
            <ul className="space-y-2">
              {items.map((text, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-[#c0c0c0]">
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[i])}
                      onChange={() => toggleItem(i)}
                      className="mt-1 h-3.5 w-3.5 accent-[#d4af37]"
                    />
                    <span>{text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="mb-6 rounded-xl border border-[#2a2a2a] px-3 py-3 text-sm text-[#888]"
            style={{ background: "#151515" }}
          >
            <span className="font-semibold text-[#d4af37] tabular-nums">{triggerCount}</span>
            {" "}times this month (simulated operational signal)
          </section>
        </div>

        <div
          className="border-t border-[#2a2a2a] px-5 py-4"
          style={{ background: "#1a1a1a" }}
        >
          <button
            type="button"
            onClick={() => {
              dismissInsightForToday(result.ruleId);
              onDismissedToday();
              onClose();
            }}
            className="w-full rounded-xl border border-[#333] py-2.5 text-xs font-bold uppercase tracking-wider text-[#888] transition-colors hover:border-[#d4af37] hover:text-[#d4af37]"
            style={{ background: "#0f0f0f" }}
          >
            Dismiss for today
          </button>
        </div>
      </aside>
    </div>
  );
}

export const InsightPanel = memo(InsightPanelInner);
