"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import type { DashboardData } from "@/lib/data";
import type { BusinessResult } from "@/lib/ruleEngine";

/** Successful payload from GET /api/metrics */
export type MetricsApiResponse = {
  metrics: DashboardData;
  analysis: BusinessResult[];
  summary: {
    totalIssues: number;
    criticalCount: number;
    lastUpdated: string;
  };
  sourceState: {
    source: "real" | "sample";
    preference: "supabase" | "csv" | "sample" | null;
    needsOnboarding: boolean;
    rowCount: number;
  };
};

export type UseMetricsReturn = {
  data: DashboardData | null;
  analysis: BusinessResult[];
  summary: MetricsApiResponse["summary"] | null;
  sourceState: MetricsApiResponse["sourceState"] | null;
  isLoading: boolean;
  error: string | null;
  fetchMetrics: (days?: number, category?: string) => Promise<void>;
  refetch: () => Promise<void>;
  lastFetched: number | null;
};

function parseRefreshIntervalMs(): number | null {
  const raw = process.env.NEXT_PUBLIC_REFRESH_INTERVAL;
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function buildMetricsUrl(days: number, category: string | undefined): string {
  const params = new URLSearchParams();
  params.set("days", String(days));
  if (category !== undefined && category !== "") {
    params.set("category", category);
  }
  return `/api/metrics?${params.toString()}`;
}

/**
 * Fetches dashboard metrics and server-side rule analysis.
 * `days` follows {@link useDashboard}'s `selectedRange` by default.
 */
export function useMetrics(): UseMetricsReturn {
  const { selectedRange } = useDashboard();
  const [data, setData] = useState<DashboardData | null>(null);
  const [analysis, setAnalysis] = useState<BusinessResult[]>([]);
  const [summary, setSummary] = useState<MetricsApiResponse["summary"] | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const [sourceState, setSourceState] = useState<MetricsApiResponse["sourceState"] | null>(null);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);
  const paramsRef = useRef<{ days: number; category: string | undefined }>({
    days: selectedRange,
    category: undefined,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const fetchMetrics = useCallback(
    async (days: number = selectedRange, category?: string) => {
      paramsRef.current = { days, category };

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (mountedRef.current && !hasLoadedRef.current) {
        setIsLoading(true);
      }
      if (mountedRef.current) {
        setError(null);
      }

      try {
        const res = await fetch(buildMetricsUrl(days, category), {
          signal: controller.signal,
        });

        if (!res.ok) {
          let message = `HTTP ${res.status}`;
          try {
            const errJson: unknown = await res.json();
            if (
              errJson !== null &&
              typeof errJson === "object" &&
              "error" in errJson &&
              typeof (errJson as { error: unknown }).error === "string"
            ) {
              message = (errJson as { error: string }).error;
            }
          } catch {
            /* ignore malformed error body */
          }
          throw new Error(message);
        }

        const json: MetricsApiResponse = await res.json();

        if (!mountedRef.current || controller.signal.aborted) return;

        setData(json.metrics);
        setAnalysis(json.analysis);
        setSummary(json.summary);
        setSourceState(json.sourceState);
        setLastFetched(Date.now());
        hasLoadedRef.current = true;
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (!mountedRef.current || controller.signal.aborted) return;

        setError(e instanceof Error ? e.message : "Unknown error");
        if (!hasLoadedRef.current) {
          setData(null);
          setAnalysis([]);
          setSummary(null);
          setSourceState(null);
        }
      } finally {
        if (abortRef.current !== controller) {
          return;
        }
        if (mountedRef.current && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [selectedRange],
  );

  const refetch = useCallback(async () => {
    await fetchMetrics(selectedRange, undefined);
  }, [fetchMetrics, selectedRange]);

  useEffect(() => {
    void fetchMetrics(selectedRange, undefined);
  }, [selectedRange, fetchMetrics]);

  useEffect(() => {
    const intervalMs = parseRefreshIntervalMs();
    if (intervalMs === null) return;

    const timerId = window.setInterval(() => {
      const { days, category } = paramsRef.current;
      void fetchMetrics(days, category);
    }, intervalMs);

    return () => window.clearInterval(timerId);
  }, [fetchMetrics]);

  return {
    data,
    analysis,
    summary,
    sourceState,
    isLoading,
    error,
    fetchMetrics,
    refetch,
    lastFetched,
  };
}
