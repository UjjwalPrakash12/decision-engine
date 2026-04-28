import type { ReactNode } from "react";

/** Avoid build-time prerender: client page calls Supabase, which needs env at SSR. */
export const dynamic = "force-dynamic";

export default function DataLayout({ children }: { children: ReactNode }) {
  return children;
}
