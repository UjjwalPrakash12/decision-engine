"use client";

import { memo, useState } from "react";

type QueryBarProps = {
  onSubmit: (question: string) => void;
  loading: boolean;
};

function QueryBarInner({ onSubmit, loading }: QueryBarProps) {
  const [value, setValue] = useState("");

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
      }}
      aria-label="Natural language query form"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask: Why did churn rise this week?"
        className="mono-ui min-h-11 flex-1 rounded-[10px] border border-[var(--border)] bg-[var(--bg-base)] px-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[rgba(99,102,241,0.5)] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
      />
      <button
        type="submit"
        disabled={loading}
        className="min-h-11 rounded-lg bg-[var(--accent)] px-4 text-[13px] font-semibold text-[var(--text-primary)] transition hover:bg-[#4F46E5] disabled:opacity-60"
      >
        {loading ? "Thinking..." : "Ask AI →"}
      </button>
    </form>
  );
}

export const QueryBar = memo(QueryBarInner);
