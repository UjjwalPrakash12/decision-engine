import type { Metadata } from "next";
import "./globals.css";
import { animationKeyframes } from "@/lib/animations";
import { DashboardProviders } from "@/context/DashboardContext";
import { DataProvider } from "@/context/DataContext";

export const metadata: Metadata = {
  metadataBase: new URL("https://decision-engine-dashboard.vercel.app"),
  title: "Decision Engine Dashboard",
  description: "Business intelligence powered by automated rule evaluation",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Decision Engine Dashboard",
    description: "Track SaaS health signals and AI-driven recommendations in real time.",
    url: "https://decision-engine-dashboard.vercel.app",
    siteName: "Decision Engine Dashboard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Decision Engine Dashboard",
    description: "AI-enhanced SaaS KPI monitoring and decision support.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: animationKeyframes }} />
      </head>
      <body>
        <DashboardProviders>
          <DataProvider>{children}</DataProvider>
        </DashboardProviders>
      </body>
    </html>
  );
}
