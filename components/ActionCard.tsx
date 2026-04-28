type ActionCardProps = {
  action: string;
  index: number;
  linkedInsight?: string;
};

export default function ActionCard({ action, index, linkedInsight }: ActionCardProps) {
  return (
    <div
      className="group relative mb-1 overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 transition-all duration-150 hover:-translate-y-[1px] hover:border-[var(--border)] hover:bg-[#131320]"
      role="article"
      aria-label={`Action ${index + 1}`}
    >
      <div className="flex items-start gap-4">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.1)] text-[13px] font-bold text-[var(--accent-light)]">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          {linkedInsight ? (
            <div className="mb-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-muted)]">In response to</p>
              <p className="mt-1 truncate text-[11px] italic text-[var(--text-muted)]">
                {linkedInsight.slice(0, 55)}
                {linkedInsight.length > 55 ? "..." : ""}
              </p>
            </div>
          ) : null}
          <p className="text-[14px] font-medium text-[var(--text-primary)]">{action}</p>
        </div>
        <span className="mt-1 text-[14px] text-[var(--border)] transition-colors group-hover:text-[var(--accent-light)]">→</span>
      </div>
    </div>
  );
}
