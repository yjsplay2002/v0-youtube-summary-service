"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { SidebarNavigation } from "@/components/sidebar-navigation";
import { SummaryProvider } from "@/components/summary-context";
import { useState, useEffect } from "react";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentVideoId = searchParams.get("videoId") || undefined;
  const [isMobile, setIsMobile] = useState(false);

  // Only show sidebar on app pages
  const showSidebar = pathname.startsWith('/app') || pathname.includes('videoId');

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!showSidebar) {
    // Landing page and other pages without sidebar
    return (
      <SummaryProvider>
        <main className="min-h-screen bg-background">
          {children}
        </main>
      </SummaryProvider>
    );
  }

  // App pages with sidebar
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
