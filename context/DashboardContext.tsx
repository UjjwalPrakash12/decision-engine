"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type TimeRange = 7 | 14 | 30;

type DashboardContextValue = {
  selectedRange: TimeRange;
  setSelectedRange: (range: TimeRange) => void;
};

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProviders({ children }: { children: ReactNode }) {
  const [selectedRange, setSelectedRangeState] = useState<TimeRange>(30);

  const setSelectedRange = useCallback((range: TimeRange) => {
    setSelectedRangeState(range);
  }, []);

  const value = useMemo(
    () => ({ selectedRange, setSelectedRange }),
    [selectedRange, setSelectedRange],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within <DashboardProviders>");
  }
  return ctx;
}
