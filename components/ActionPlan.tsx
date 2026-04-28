"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { BusinessResult } from "@/lib/ruleEngine";

type PlanStep = {
  step: number;
  title: string;
  days: number;
  impact: "Low" | "Medium" | "High";
  tasks: string[];
};

type ActionPlanProps = {
  results: BusinessResult[];
  timeRange: number;
};

const impactColor: Record<PlanStep["impact"], string> = {
  Low: "#3b82f6",
  Medium: "var(--accent-light)",
  High: "#ef4444",
};

function ActionPlanInner({ results, timeRange }: ActionPlanProps) {
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canGenerate = results.length > 0;
  const checklistKey = useMemo(
    () => `decision-engine:action-plan:${timeRange}:${results.map((r) => r.ruleId).join(",")}`,
    [results, timeRange],
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(checklistKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setChecked(parsed);
    } catch {
      setChecked({});
    }
  }, [checklistKey]);

  useEffect(() => {
    sessionStorage.setItem(checklistKey, JSON.stringify(checked));
  }, [checklistKey, checked]);

  function buildFallbackPlan(): PlanStep[] {
    const top = results.slice(0, 3);
    return [
      {
        step: 1,
        title: "Stabilize critical metrics",
        days: 3,
        impact: "High",
        tasks: top.length
          ? top.map((r) => `Address: ${r.name}`)
          : ["Review dashboard health and identify immediate risks"],
      },
      {
        step: 2,
        title: "Execute targeted fixes",
        days: 7,
        impact: "Medium",
        tasks: ["Run controlled experiments", "Track day-over-day improvement"],
      },
    ];
  }

  async function generatePlan(): Promise<void> {
    if (!canGenerate) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results, timeRange }),
      });

      const raw = await res.text();
      let json: { plan?: PlanStep[] } | null = null;
      if (raw.trim().length > 0) {
        try {
          json = JSON.parse(raw) as { plan?: PlanStep[] };
        } catch {
          json = null;
        }
      }

      if (res.ok && Array.isArray(json?.plan)) {
        setPlan(json.plan);
      } else {
        setPlan(buildFallbackPlan());
        setLoadError("Using fallback plan because AI response was unavailable.");
      }
    } catch {
      setPlan(buildFallbackPlan());
      setLoadError("Using fallback plan because AI response failed.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void generatePlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  return (
    <section className="rounded-2xl border border-[var(--border)] p-5" style={{ background: "var(--bg-surface)" }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">AI action plan</h3>
        <button
          type="button"
          onClick={() => void generatePlan()}
          disabled={!canGenerate || isLoading}
          className="rounded-lg border border-[#333] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] transition-colors enabled:hover:border-[var(--accent-light)] enabled:hover:text-[var(--accent-light)] disabled:opacity-40"
          style={{ background: "var(--bg-base)" }}
        >
          {isLoading ? "Generating..." : "Regenerate"}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--bg-base)]" />
          ))}
        </div>
      ) : plan.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No plan available. Resolve active insights first.</p>
      ) : (
        <div className="space-y-3">
          {loadError ? (
            <p className="text-xs text-[var(--accent-light)]" role="status" aria-live="polite">
              {loadError}
            </p>
          ) : null}
          <ol className="space-y-3">
            {plan.map((step) => (
              <li key={`${step.step}-${step.title}`} className="rounded-xl border border-[var(--border)] p-3" style={{ background: "var(--bg-base)" }}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--accent-light)]">
                    {step.step}. {step.title}
                  </p>
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: impactColor[step.impact] }}>
                    {step.impact} impact · {step.days}d
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                  {step.tasks.map((task, index) => {
                    const id = `${step.step}-${index}-${task}`;
                    return (
                      <li key={id}>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1 accent-[var(--accent-light)]"
                            checked={Boolean(checked[id])}
                            onChange={(e) =>
                              setChecked((prev) => ({
                                ...prev,
                                [id]: e.target.checked,
                              }))
                            }
                          />
                          <span>{task}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

export const ActionPlan = memo(ActionPlanInner);
