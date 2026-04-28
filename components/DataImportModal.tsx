"use client";

import { memo, useMemo, useRef, useState } from "react";
import { parseMetricsCsv, type MetricImportError, type MetricImportRow } from "@/lib/csvMetrics";

type ImportSummary = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: MetricImportError[];
};

type DataImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: (summary: ImportSummary) => void;
};

function DataImportModalInner({ open, onClose, onImported }: DataImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const parsed = useMemo(() => parseMetricsCsv(csvText), [csvText]);
  const previewRows: MetricImportRow[] = useMemo(() => parsed.rows.slice(0, 10), [parsed.rows]);
  const canSubmit = csvText.length > 0 && parsed.totalRows <= 365 && parsed.rows.length > 0;

  async function loadFile(file: File) {
    const text = await file.text();
    setCsvText(text);
    setFileName(file.name);
    setRequestError(null);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#2a2a2a] p-5 sm:p-6"
        style={{ background: "#1a1a1a" }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[#f0f0f0]">Import KPI Data</h3>
            <p className="mt-1 text-xs text-[#666]">
              Upload CSV with columns: date,revenue,customers,conversionRate,churnRate,avgOrderValue
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#333] px-2.5 py-1 text-xs text-[#888] hover:border-[#d4af37] hover:text-[#d4af37]"
          >
            Close
          </button>
        </div>

        <div
          className={`rounded-xl border border-dashed p-5 text-center transition-colors ${
            isDragOver ? "border-[#d4af37]" : "border-[#3a3a3a]"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) await loadFile(file);
          }}
        >
          <p className="text-sm text-[#bbb]">Drag and drop CSV here</p>
          <p className="my-2 text-xs text-[#555]">or</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-[#d4af37]/40 bg-[#0f0f0f] px-3 py-1.5 text-xs font-semibold text-[#d4af37]"
          >
            Choose file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await loadFile(file);
            }}
          />
          {fileName ? <p className="mt-3 text-xs text-[#666]">Loaded: {fileName}</p> : null}
        </div>

        {parsed.totalRows > 0 ? (
          <div className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#141414] p-3 text-xs text-[#999]">
            Rows detected: {parsed.totalRows} · Valid after dedupe: {parsed.rows.length}
            {parsed.totalRows > 365 ? (
              <span className="ml-2 text-red-400">Maximum 365 rows allowed.</span>
            ) : null}
          </div>
        ) : null}

        {previewRows.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#666]">Preview (first 10 rows)</p>
            <div className="overflow-x-auto rounded-xl border border-[#2a2a2a]">
              <table className="min-w-full text-xs">
                <thead style={{ background: "#101010" }}>
                  <tr className="text-[#777]">
                    <th className="px-3 py-2 text-left">date</th>
                    <th className="px-3 py-2 text-left">revenue</th>
                    <th className="px-3 py-2 text-left">customers</th>
                    <th className="px-3 py-2 text-left">conversionRate</th>
                    <th className="px-3 py-2 text-left">churnRate</th>
                    <th className="px-3 py-2 text-left">avgOrderValue</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={`${r.date}-${i}`} className="border-t border-[#222] text-[#c6c6c6]">
                      <td className="px-3 py-2">{r.date}</td>
                      <td className="px-3 py-2">{r.revenue}</td>
                      <td className="px-3 py-2">{r.customers}</td>
                      <td className="px-3 py-2">{r.conversionRate}</td>
                      <td className="px-3 py-2">{r.churnRate}</td>
                      <td className="px-3 py-2">{r.avgOrderValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {parsed.errors.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#ef4444]">Validation issues</p>
            <ul className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-[#3b1f1f] bg-[#1a1111] p-3 text-xs text-[#fca5a5]">
              {parsed.errors.map((err, i) => (
                <li key={`${err.row}-${i}`}>
                  Row {err.row}: {err.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {requestError ? <p className="mt-4 text-xs text-red-400">{requestError}</p> : null}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#333] px-4 py-2 text-xs text-[#888]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              setRequestError(null);
              try {
                const res = await fetch("/api/import", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ csv: csvText, fileName }),
                });
                const json = (await res.json()) as
                  | ImportSummary
                  | { error: string }
                  | { ok: false; error: { message: string } };
                if (!res.ok) {
                  if ("error" in json && typeof json.error === "string") {
                    throw new Error(json.error);
                  }
                  if ("error" in json && typeof json.error === "object" && json.error?.message) {
                    throw new Error(json.error.message);
                  }
                  throw new Error("Import failed");
                }
                if (
                  "inserted" in json &&
                  "updated" in json &&
                  "skipped" in json &&
                  "errors" in json
                ) {
                  onImported(json);
                } else {
                  throw new Error("Unexpected import response");
                }
                onClose();
                setCsvText("");
                setFileName("");
              } catch (e) {
                setRequestError(e instanceof Error ? e.message : "Import failed");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="rounded-lg border border-[#d4af37]/50 bg-[#0f0f0f] px-4 py-2 text-xs font-semibold text-[#d4af37] disabled:opacity-50"
          >
            {isSubmitting ? "Importing..." : "Confirm import"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const DataImportModal = memo(DataImportModalInner);
