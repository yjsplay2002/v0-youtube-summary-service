"use client";

import { useSearchParams } from "next/navigation";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { SummaryProvider } from "@/components/summary-context";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const searchParams = useSearchParams();
  const currentVideoId = searchParams.get("videoId") || undefined;

  return (
    <SummaryProvider>
      <div className="flex min-h-screen bg-background">
        <SidebarNavigation currentVideoId={currentVideoId} />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </SummaryProvider>
  );
}
