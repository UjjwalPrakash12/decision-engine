import { DashboardPageSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0f0f0f] py-6">
      <DashboardPageSkeleton />
    </main>
  );
}
