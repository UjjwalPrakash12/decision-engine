"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";

type MetricRow = Database["public"]["Tables"]["daily_metrics"]["Row"];
type EditableField =
  | "revenue"
  | "customers"
  | "conversion_rate"
  | "churn_rate"
  | "avg_order_value";

type EditState = {
  id: string;
  field: EditableField;
  value: string;
} | null;

function toInputDate(value?: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function parseNumber(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function toCsv(rows: MetricRow[]): string {
  const header = [
    "date",
    "revenue",
    "customers",
    "conversionRate",
    "churnRate",
    "avgOrderValue",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.date,
      r.revenue,
      r.customers,
      r.conversion_rate,
      r.churn_rate,
      r.avg_order_value,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function clampField(field: EditableField, value: number): number {
  if (field === "customers") return Math.max(0, Math.round(value));
  if (field === "conversion_rate" || field === "churn_rate") {
    return Math.max(0, Math.min(1, value));
  }
  return Math.max(0, Math.round(value * 100) / 100);
}

export default function DataManagementPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [error, setError] = useState<string | null>(() =>
    supabase
      ? null
      : "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see README).",
  );
  const [toast, setToast] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [edit, setEdit] = useState<EditState>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  useEffect(() => {
    const id = toast ? window.setTimeout(() => setToast(null), 2600) : null;
    return () => {
      if (id) clearTimeout(id);
    };
  }, [toast]);

  useEffect(() => {
    if (!supabase) return;
    const client: SupabaseClient<Database> = supabase;

    void (async () => {
      setLoading(true);
      setError(null);
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) {
        setError("You must be signed in to manage data.");
        setLoading(false);
        return;
      }
      setUserId(user.id);

      const { data, error: queryError } = await client
        .from("daily_metrics")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (queryError) {
        setError("Failed to load metrics.");
      } else {
        setRows(data ?? []);
      }
      setLoading(false);
    })();
  }, [supabase]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    });
  }, [rows, startDate, endDate]);

  async function saveInlineEdit(row: MetricRow, field: EditableField) {
    if (!supabase) return;
    if (!edit || edit.id !== row.id || edit.field !== field) return;
    const parsed = parseNumber(edit.value);
    if (parsed === null) {
      setToast("Please enter a valid number.");
      return;
    }

    const nextValue = clampField(field, parsed);
    const prevRows = rows;
    const optimistic = rows.map((r) =>
      r.id === row.id ? { ...r, [field]: nextValue } : r,
    );
    setRows(optimistic);
    setEdit(null);

    let patch:
      | Pick<MetricRow, "revenue">
      | Pick<MetricRow, "customers">
      | Pick<MetricRow, "conversion_rate">
      | Pick<MetricRow, "churn_rate">
      | Pick<MetricRow, "avg_order_value">;

    if (field === "revenue") patch = { revenue: nextValue };
    else if (field === "customers") patch = { customers: nextValue };
    else if (field === "conversion_rate") patch = { conversion_rate: nextValue };
    else if (field === "churn_rate") patch = { churn_rate: nextValue };
    else patch = { avg_order_value: nextValue };

    const { error: updateError } = await supabase
      .from("daily_metrics")
      .update(patch)
      .eq("id", row.id);

    if (updateError) {
      setRows(prevRows);
      setToast("Update failed.");
      return;
    }
    setToast("Row updated.");
  }

  async function deleteRow(row: MetricRow) {
    if (!supabase) return;
    const prevRows = rows;
    setRows((cur) => cur.filter((r) => r.id !== row.id));
    const { error: delError } = await supabase
      .from("daily_metrics")
      .delete()
      .eq("id", row.id);
    if (delError) {
      setRows(prevRows);
      setToast("Delete failed.");
      return;
    }
    setToast("Row deleted.");
  }

  async function bulkDeleteByRange() {
    if (!supabase) return;
    if (!startDate || !endDate || !userId) {
      setToast("Set both start and end dates first.");
      return;
    }
    setIsBulkDeleting(true);
    const prevRows = rows;
    const toDelete = rows.filter((r) => r.date >= startDate && r.date <= endDate);
    if (toDelete.length === 0) {
      setIsBulkDeleting(false);
      setToast("No rows in selected range.");
      return;
    }
    setRows((cur) => cur.filter((r) => !(r.date >= startDate && r.date <= endDate)));

    const { error: delError } = await supabase
      .from("daily_metrics")
      .delete()
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate);

    setIsBulkDeleting(false);
    if (delError) {
      setRows(prevRows);
      setToast("Bulk delete failed.");
      return;
    }
    setToast(`Deleted ${toDelete.length} row(s).`);
  }

  function exportCurrentCsv() {
    const csv = toCsv(filteredRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metrics-export.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0f0f] px-4 py-8 text-[#888] sm:px-6">
        Loading metrics...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#0f0f0f] px-4 py-8 text-red-400 sm:px-6">
        {error}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f0f0f] px-4 py-8 font-mono text-[#f0f0f0] sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border border-[#2a2a2a] p-5" style={{ background: "#1a1a1a" }}>
          <h1 className="text-lg font-semibold text-[#d4af37]">Manage Uploaded Metrics</h1>
          <p className="mt-1 text-sm text-[#777]">
            Review, edit, delete, and export your KPI records.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="text-xs text-[#888]">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#333] bg-[#0f0f0f] px-3 py-2 text-sm text-[#ddd] outline-none"
              />
            </label>
            <label className="text-xs text-[#888]">
              End date
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#333] bg-[#0f0f0f] px-3 py-2 text-sm text-[#ddd] outline-none"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={bulkDeleteByRange}
                disabled={isBulkDeleting}
                className="w-full rounded-lg border border-red-500/35 bg-[#141010] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-red-400 disabled:opacity-50"
              >
                {isBulkDeleting ? "Deleting..." : "Bulk delete range"}
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={exportCurrentCsv}
                className="w-full rounded-lg border border-[#d4af37]/45 bg-[#171717] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[#d4af37]"
              >
                Export CSV
              </button>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-[#2a2a2a] p-3 sm:p-4" style={{ background: "#1a1a1a" }}>
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-[#777]">
            <span>Total rows: {rows.length}</span>
            <span>Filtered rows: {filteredRows.length}</span>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] text-left text-[11px] uppercase tracking-wider text-[#666]">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Revenue</th>
                  <th className="px-3 py-2">Customers</th>
                  <th className="px-3 py-2">Conversion</th>
                  <th className="px-3 py-2">Churn</th>
                  <th className="px-3 py-2">AOV</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-sm text-[#666]" colSpan={7}>
                      No rows match this range.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-[#222] last:border-b-0">
                      <td className="px-3 py-2 text-[#cfcfcf]">{toInputDate(row.date)}</td>
                      {(
                        [
                          ["revenue", row.revenue],
                          ["customers", row.customers],
                          ["conversion_rate", row.conversion_rate],
                          ["churn_rate", row.churn_rate],
                          ["avg_order_value", row.avg_order_value],
                        ] as const
                      ).map(([field, value]) => {
                        const active = edit?.id === row.id && edit.field === field;
                        return (
                          <td key={field} className="px-3 py-2">
                            {active ? (
                              <input
                                autoFocus
                                value={edit.value}
                                onChange={(e) =>
                                  setEdit((prev) =>
                                    prev ? { ...prev, value: e.target.value } : prev,
                                  )
                                }
                                onBlur={() => void saveInlineEdit(row, field)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    void saveInlineEdit(row, field);
                                  }
                                  if (e.key === "Escape") {
                                    setEdit(null);
                                  }
                                }}
                                className="w-24 rounded border border-[#3a3a3a] bg-[#0f0f0f] px-2 py-1 text-xs text-[#eee]"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setEdit({ id: row.id, field, value: String(value) })
                                }
                                className="rounded px-1 py-0.5 text-left text-[#cfcfcf] hover:bg-[#222]"
                              >
                                {field === "conversion_rate" || field === "churn_rate"
                                  ? Number(value).toFixed(4)
                                  : value}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void deleteRow(row)}
                          className="rounded border border-red-500/35 px-2 py-1 text-xs text-red-400 hover:bg-[#1b1111]"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {toast ? (
        <div
          className="fixed right-4 top-4 z-50 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2 text-xs text-[#d4af37]"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      ) : null}
    </main>
  );
}
