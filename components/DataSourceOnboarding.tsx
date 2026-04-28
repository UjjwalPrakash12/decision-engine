"use client";

import { memo, useState } from "react";

type SourceOption = "supabase" | "csv" | "sample";

type DataSourceOnboardingProps = {
  open: boolean;
  onChooseSupabase: () => Promise<void> | void;
  onChooseCsv: () => Promise<void> | void;
  onChooseSample: () => Promise<void> | void;
};

function DataSourceOnboardingInner({
  open,
  onChooseSupabase,
  onChooseCsv,
  onChooseSample,
}: DataSourceOnboardingProps) {
  const [busy, setBusy] = useState<SourceOption | null>(null);

  if (!open) return null;

  async function run(option: SourceOption, fn: () => Promise<void> | void) {
    setBusy(option);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      className="rounded-2xl border border-[#2a2a2a] p-5 sm:p-6"
      style={{ background: "#1a1a1a" }}
      aria-label="Choose dashboard data source"
    >
      <h2 className="text-lg font-semibold text-[#f0f0f0]">Choose your data source</h2>
      <p className="mt-1 text-sm text-[#777]">
        First time here? Select how you want to populate your dashboard.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => void run("supabase", onChooseSupabase)}
          disabled={busy !== null}
          className="rounded-xl border border-[#2a2a2a] p-4 text-left transition-colors hover:border-[#d4af37]"
          style={{ background: "#141414" }}
        >
          <p className="text-sm font-semibold text-[#d4af37]">Connect Supabase table</p>
          <p className="mt-1 text-xs text-[#777]">Use your own `daily_metrics` rows.</p>
          {busy === "supabase" ? <p className="mt-2 text-xs text-[#888]">Saving...</p> : null}
        </button>

        <button
          type="button"
          onClick={() => void run("csv", onChooseCsv)}
          disabled={busy !== null}
          className="rounded-xl border border-[#2a2a2a] p-4 text-left transition-colors hover:border-[#d4af37]"
          style={{ background: "#141414" }}
        >
          <p className="text-sm font-semibold text-[#d4af37]">Upload CSV</p>
          <p className="mt-1 text-xs text-[#777]">Import KPI data from spreadsheet exports.</p>
          {busy === "csv" ? <p className="mt-2 text-xs text-[#888]">Opening...</p> : null}
        </button>

        <button
          type="button"
          onClick={() => void run("sample", onChooseSample)}
          disabled={busy !== null}
          className="rounded-xl border border-[#2a2a2a] p-4 text-left transition-colors hover:border-[#d4af37]"
          style={{ background: "#141414" }}
        >
          <p className="text-sm font-semibold text-[#d4af37]">Use sample data temporarily</p>
          <p className="mt-1 text-xs text-[#777]">Explore dashboard behavior with seeded sample metrics.</p>
          {busy === "sample" ? <p className="mt-2 text-xs text-[#888]">Applying...</p> : null}
        </button>
      </div>
    </section>
  );
}

export const DataSourceOnboarding = memo(DataSourceOnboardingInner);
