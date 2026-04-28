"use client";

import { animations } from "@/lib/animations";

const SHIMMER_BG =
  "linear-gradient(90deg, #161616 0%, #252525 45%, #161616 90%)";

export type SkeletonProps = {
  className?: string;
  /** Visually hidden label for screen readers */
  label?: string;
};

/**
 * Generic shimmer placeholder. Compose with Tailwind `h-*` / `w-*` via className.
 */
export function Skeleton({ className = "", label = "Loading" }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={`overflow-hidden rounded-xl border border-[#2a2a2a] ${className}`}
      style={{
        background: SHIMMER_BG,
        backgroundSize: "200% 100%",
        animation: animations.skeletonShimmer,
      }}
    />
  );
}

/** KPI strip placeholders — fixed row layout to prevent CLS */
export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[132px] w-full" label={`Loading KPI ${i + 1}`} />
      ))}
    </div>
  );
}

/** Main grid chart area */
export function ChartsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="flex flex-col gap-6 lg:col-span-3">
        <Skeleton className="h-[260px] w-full" label="Loading revenue chart" />
        <Skeleton className="h-[220px] w-full" label="Loading customers chart" />
      </div>
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Skeleton className="h-[140px] w-full" label="Loading severity panel" />
        <Skeleton className="h-[200px] w-full" label="Loading insights panel" />
      </div>
    </div>
  );
}

/** Full-width list placeholders */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full" label={`Loading row ${i + 1}`} />
      ))}
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
      <Skeleton className="h-10 w-64" label="Loading page header" />
      <KpiRowSkeleton />
      <ChartsGridSkeleton />
      <ListSkeleton rows={5} />
      <ListSkeleton rows={5} />
    </div>
  );
}
