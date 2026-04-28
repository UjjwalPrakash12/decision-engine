"use client";

import { useCallback, useState } from "react";

type ExplainPayload = {
  insight: string;
  severity: string;
  metrics: {
    revenue: number[];
    customers: number[];
  };
};

export type UseExplainReturn = {
  explanation: string;
  isLoading: boolean;
  error: string | null;
  explain: (payload: ExplainPayload) => Promise<string>;
  reset: () => void;
};

export function useExplain(): UseExplainReturn {
  const [explanation, setExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setExplanation("");
    setError(null);
    setIsLoading(false);
  }, []);

  const explain = useCallback(async (payload: ExplainPayload) => {
    setIsLoading(true);
    setError(null);
    setExplanation("");

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let finalText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        finalText += decoder.decode(value, { stream: true });
        setExplanation(finalText);
      }

      return finalText;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to explain insight";
      setError(message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { explanation, isLoading, error, explain, reset };
}
