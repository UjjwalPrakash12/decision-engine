"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f0f] px-6 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-[#666]">Dashboard error</p>
      <h1 className="mt-3 text-xl font-bold text-[#d4af37]">Something broke</h1>
      <p className="mt-2 max-w-lg text-sm text-[#999]">{error.message || "Unexpected runtime failure."}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg border border-[#d4af37]/40 bg-[#1a1a1a] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#d4af37]"
      >
        Try again
      </button>
    </main>
  );
}
