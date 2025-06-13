"use client";

import { useSearchParams } from "next/navigation";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { SummaryProvider } from "@/components/summary-context";
import { useState, useEffect } from "react";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const searchParams = useSearchParams();
  const currentVideoId = searchParams.get("videoId") || undefined;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <SummaryProvider>
      <div className="flex min-h-screen bg-background">
        <SidebarNavigation currentVideoId={currentVideoId} />
        <main className={`flex-1 ${isMobile ? 'w-full' : ''}`}>
          {children}
        </main>
      </div>
    </SummaryProvider>
  );
}
