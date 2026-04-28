"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dashboardData } from "@/lib/data";
import type { DashboardData } from "@/lib/data";
import type { ParseResult } from "@/lib/csvParser";
import { parsedRowsToMetrics } from "@/lib/csvParser";

export type DataSource = "demo" | "uploaded";

const STORAGE_KEY = "de_data";

type PersistedPayload = {
  metrics: DashboardData;
  source: DataSource;
  fileName: string | null;
  rowCount: number;
};

export type DataContextValue = {
  metrics: DashboardData | null;
  dayLabels: string[];
  source: DataSource;
  fileName: string | null;
  rowCount: number;
  isLoaded: boolean;
  storageWarning: string | null;
  loadDemo: () => void;
  loadFromCSV: (result: ParseResult, fileName: string) => void;
  reset: () => void;
};

export const DataContext = createContext<DataContextValue | null>(null);

function persistState(payload: PersistedPayload): string | null {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return null;
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      return "Storage quota exceeded — your session may not persist after refresh.";
    }
    return "Could not save data to session storage.";
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [source, setSource] = useState<DataSource>("demo");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedPayload;
      if (parsed?.metrics && Array.isArray(parsed.metrics.labels)) {
        setMetrics(parsed.metrics);
        setSource(parsed.source ?? "uploaded");
        setFileName(parsed.fileName ?? null);
        setRowCount(parsed.rowCount ?? parsed.metrics.labels.length);
        setIsLoaded(true);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const dayLabels = useMemo(
    () => (metrics ? [...metrics.labels] : []),
    [metrics],
  );

  const loadDemo = useCallback(() => {
    const m = { ...dashboardData };
    const warn = persistState({
      metrics: m,
      source: "demo",
      fileName: null,
      rowCount: m.labels.length,
    });
    setStorageWarning(warn);
    setMetrics(m);
    setSource("demo");
    setFileName(null);
    setRowCount(m.labels.length);
    setIsLoaded(true);
  }, []);

  const loadFromCSV = useCallback((result: ParseResult, name: string) => {
    if (!result.success || !result.data?.length) return;
    const m = parsedRowsToMetrics(result.data);
    const warn = persistState({
      metrics: m,
      source: "uploaded",
      fileName: name,
      rowCount: result.data.length,
    });
    setStorageWarning(warn);
    setMetrics(m);
    setSource("uploaded");
    setFileName(name);
    setRowCount(result.data.length);
    setIsLoaded(true);
  }, []);

  const reset = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setMetrics(null);
    setSource("demo");
    setFileName(null);
    setRowCount(0);
    setIsLoaded(false);
    setStorageWarning(null);
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      metrics,
      dayLabels,
      source,
      fileName,
      rowCount,
      isLoaded,
      storageWarning,
      loadDemo,
      loadFromCSV,
      reset,
    }),
    [
      metrics,
      dayLabels,
      source,
      fileName,
      rowCount,
      isLoaded,
      storageWarning,
      loadDemo,
      loadFromCSV,
      reset,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within <DataProvider>");
  }
  return ctx;
}
