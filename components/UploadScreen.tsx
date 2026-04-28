"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { parseCSV, type ParseResult } from "@/lib/csvParser";
import { useData } from "@/context/DataContext";

const MAX_BYTES = 2 * 1024 * 1024;

export function ChartLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="10"
        fill="rgba(99,102,241,0.15)"
        stroke="rgba(99,102,241,0.3)"
      />
      <path
        d="M9 26 L14 20 L19 22 L24 14 L29 17 L33 11"
        stroke="#818CF8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 29h24"
        stroke="#818CF8"
        strokeOpacity="0.45"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UploadArrowIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M16 6v14M10 12l6-6 6 6"
        stroke="var(--text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 26h16" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FileDocIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="var(--text-secondary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ValueIcon({ type }: { type: "trend" | "root" | "action" }) {
  if (type === "trend") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 18h16M6 15l3-4 3 2 4-6 2 2" stroke="#818CF8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "root") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M13 3 5 14h6l-1 7 9-13h-6l1-5Z" stroke="#818CF8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 7h8M8 12h8M8 17h5M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="#818CF8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const TEMPLATE_HEADER =
  "date,revenue,customers,conversion_rate,churn_rate\n";

export function UploadScreen() {
  const { loadDemo, loadFromCSV } = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const [isDragging, setIsDragging] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const resetFile = useCallback(() => {
    setFile(null);
    setFileError(null);
    setParseResult(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleFile = useCallback((f: File | undefined | null) => {
    if (!f) return;
    setFile(f);
    setFileError(null);
    setParseResult(null);
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".csv")) {
      setFileError("Please upload a .csv file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError("File is too large. Please upload a CSV under 2MB.");
      return;
    }
    if (f.size === 0) {
      setFileError(
        "The file appears to be empty. Please add at least 7 rows of data.",
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setFileError(null);
      setParseResult(parseCSV(text));
    };
    reader.onerror = () => {
      setFileError("Could not read the file. Please try again.");
    };
    reader.readAsText(f, "UTF-8");
  }, []);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    handleFile(f);
  };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_HEADER], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "decision-engine-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const dropZoneStyle = isDragging
    ? {
        border: "1.5px dashed var(--accent)",
        background: "rgba(99,102,241,0.06)",
        boxShadow: "0 0 0 4px rgba(99,102,241,0.08)",
      }
    : {
        border: "1.5px dashed var(--border)",
        background: "var(--bg-surface)",
      };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="grid h-full grid-cols-1 md:grid-cols-[45%_55%]">
        <aside className="hidden border-r border-[var(--border-subtle)] bg-[linear-gradient(160deg,#111118_0%,#0A0A0F_100%)] md:block">
          <div className="flex h-full flex-col justify-between p-12">
            <div>
              <ChartLogo />
              <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.5px] text-[var(--text-primary)]">
                Decision Engine
              </h1>
              <p className="mt-1 text-[12px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Command Center
              </p>
              <div className="relative mt-10 space-y-8 pl-8">
                <div className="absolute bottom-5 left-[10px] top-2 w-px bg-[var(--border)]" />
                {([
                  ["trend", "Instant trend detection", "Rule engine analyzes 30+ days of data automatically"],
                  ["root", "Root cause surfacing", "Every insight maps directly to a specific metric signal"],
                  ["action", "Prioritized action plan", "Recommendations ranked by business impact, not complexity"],
                ] as const).map(([type, title, subtitle]) => (
                  <div key={title} className="relative flex gap-3">
                    <span className="absolute -left-8 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--bg-card)]">
                      <ValueIcon type={type} />
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-[var(--text-primary)]">{title}</p>
                      <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[13px] italic text-[var(--text-muted)]">
              Used by operators who need clarity, not complexity.
            </p>
          </div>
        </aside>

        <main className="flex h-full items-center justify-center bg-[var(--bg-base)] px-6 py-8 md:px-12">
          <div className="w-full max-w-[460px]">
            <div className="mb-8 md:hidden">
              <div className="flex items-center gap-3">
                <ChartLogo className="h-10 w-10" />
                <div>
                  <p className="text-[22px] font-semibold text-[var(--text-primary)]">Decision Engine</p>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Command Center</p>
                </div>
              </div>
            </div>

            <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--text-muted)]">Get started</p>
            <h2 className="mt-2 text-[22px] font-semibold text-[var(--text-primary)]">Upload your business data</h2>
            <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
              A CSV with daily revenue, customers, conversion and churn rate.
            </p>

            <div
              className="mt-6 rounded-[14px] p-10 text-center transition-all"
              style={dropZoneStyle}
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {!file ? (
                <>
                  <div className="flex justify-center">
                    <UploadArrowIcon />
                  </div>
                  <p className="mt-4 text-[15px] font-medium text-[var(--text-secondary)]">Drop your CSV here</p>
                  <p className="mt-2 text-[12px] text-[var(--text-muted)]">Accepts .csv files up to 2MB</p>
                  <button
                    type="button"
                    className="mt-5 rounded-lg border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.12)] px-5 py-2 text-[13px] font-medium text-[var(--accent-light)] transition hover:bg-[rgba(99,102,241,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(99,102,241,0.45)]"
                    onClick={() => inputRef.current?.click()}
                  >
                    Browse file
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={onInputChange}
                  />
                </>
              ) : (
                <div className="space-y-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <FileDocIcon />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] text-[var(--text-primary)]">{file.name}</p>
                        <p className="text-[12px] text-[var(--text-muted)]">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-[13px] text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                      onClick={resetFile}
                    >
                      ×
                    </button>
                  </div>

                  {fileError ? (
                    <div
                      className="rounded-lg border p-3"
                      style={{ borderColor: "var(--critical)", background: "rgba(239,68,68,0.04)" }}
                    >
                      <p className="text-[13px] text-[var(--critical)]">{fileError}</p>
                      <button
                        type="button"
                        className="mt-2 text-[13px] text-[var(--text-secondary)] underline underline-offset-2"
                        onClick={resetFile}
                      >
                        Try a different file
                      </button>
                    </div>
                  ) : null}

                  {!fileError && parseResult ? (
                    parseResult.success && parseResult.data ? (
                      <div className="space-y-3">
                        <p className="text-[14px] text-[var(--positive)]">✓ {parseResult.data.length} rows ready to analyze</p>
                        {parseResult.warnings.length > 0 ? (
                          <p className="text-[13px] text-[var(--warning)]">
                            {parseResult.warnings.length} warning(s). Some rows were skipped.
                          </p>
                        ) : null}
                        <button
                          type="button"
                          className="w-full rounded-lg bg-[var(--accent)] px-6 py-2.5 text-[14px] font-semibold text-[var(--text-primary)] transition hover:bg-[#4F46E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(99,102,241,0.45)]"
                          onClick={() => loadFromCSV(parseResult, file.name)}
                        >
                          Load dashboard →
                        </button>
                      </div>
                    ) : (
                      <div
                        className="rounded-lg border p-3"
                        style={{ borderColor: "var(--critical)", background: "rgba(239,68,68,0.04)" }}
                      >
                        <ul className="space-y-1 text-[13px] text-[var(--critical)]">
                          {parseResult.errors.map((err) => (
                            <li key={err}>{err}</li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className="mt-2 text-[13px] text-[var(--text-secondary)] underline underline-offset-2"
                          onClick={resetFile}
                        >
                          Try a different file
                        </button>
                      </div>
                    )
                  ) : null}
                </div>
              )}
            </div>

            <p className="mt-4 text-[13px] text-[var(--text-secondary)]">
              No data ready? → Explore with{" "}
              <button
                type="button"
                className="text-[var(--accent-light)] transition hover:underline"
                onClick={() => loadDemo()}
              >
                demo data
              </button>
            </p>

            <div className="mt-4">
              <button
                type="button"
                className="text-[12px] text-[var(--text-muted)] transition hover:text-[var(--text-secondary)]"
                onClick={() => setGuideOpen((o) => !o)}
                aria-expanded={guideOpen}
              >
                What columns does my CSV need? {guideOpen ? "↓" : "→"}
              </button>
              {guideOpen ? (
                <div className="mt-3 space-y-3">
                  <pre className="mono-ui overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3 text-[12px]">
                    <span className="text-[var(--accent-light)]">date,revenue,customers,conversion_rate,churn_rate</span>
                    {"\n"}
                    <span className="text-[var(--text-secondary)]">2026-01-01,12500,420,2.4,1.2</span>
                    {"\n"}
                    <span className="text-[var(--text-secondary)]">2026-01-02,13200,435,2.5,1.1</span>
                  </pre>
                  <ul className="space-y-1 text-[12px] text-[var(--text-muted)]">
                    <li>Headers are required and case-insensitive.</li>
                    <li>Minimum 7 rows, maximum 365 rows.</li>
                    <li>Dates must be YYYY-MM-DD and are auto-sorted.</li>
                    <li>Revenue/customers must be positive values.</li>
                    <li>Rates must be in decimal percent form (0 to 100).</li>
                  </ul>
                  <button
                    type="button"
                    className="text-[12px] text-[var(--accent-light)] transition hover:underline"
                    onClick={downloadTemplate}
                  >
                    Download blank template
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
