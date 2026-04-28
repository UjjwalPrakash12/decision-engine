"use client";

import { memo } from "react";

type QueryResultProps = {
  text: string;
  loading: boolean;
  error: string | null;
};

function QueryResultInner({ text, loading, error }: QueryResultProps) {
  return (
    <section
      className="min-h-28 rounded-xl border border-[var(--border)] p-4"
      style={{ background: "var(--bg-base)" }}
      aria-live="polite"
      aria-label="Query answer"
    >
      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : loading ? (
        <p className="text-sm text-[var(--text-secondary)]">{text || "Generating answer..."}</p>
      ) : text ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#cfcfcf]">{text}</p>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">Ask a business question to get an AI-generated analysis.</p>
      )}
    </section>
  );
}

export const QueryResult = memo(QueryResultInner);
