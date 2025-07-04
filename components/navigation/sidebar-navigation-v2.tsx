"use client";

import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InfiniteScroll } from "@/components/ui/infinite-scroll";
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  FileText, 
  Calendar, 
  User, 
  RefreshCw, 
  MessageSquare,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth-context";
import { AuthButton } from "@/components/auth-button";
import { getUserSubscriptionTier } from "@/app/lib/auth-utils";
import { UsageTracker } from "@/components/usage-tracker";
import { ThemeToggle } from "@/components/theme-toggle";
import { useInfiniteSummaries, Summary } from "@/hooks/use-infinite-summaries";

interface SidebarNavigationProps {
  currentVideoId?: string;
}

export function SidebarNavigationV2({ currentVideoId }: SidebarNavigationProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTier = getUserSubscriptionTier(user);

  // Use infinite summaries hook
  const {
    summaries,
    loading: summariesLoading,
    error,
    hasNextPage,
    loadNextPage,
    refresh
  } = useInfiniteSummaries({
    userId: isAuthenticated ? user?.id : undefined,
    enabled: true, // 항상 활성화하여 첫 로딩 시에도 요약 리스트를 불러옴
    pageSize: 20
  });

  // Check mobile size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
    });
  };

  const truncateTitle = (title: string, maxLength: number = 50) => {
    return title.length > maxLength ? `${title.substring(0, maxLength)}...` : title;
  };

  const handleRefresh = () => {
    refresh();
  };

  // Loading state for initial load
  const isInitialLoading = authLoading || (summariesLoading && summaries.length === 0);

  return (
    <>
      {/* Mobile toggle button */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
          aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      )}

      {/* Mobile backdrop */}
      {isMobile && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-30"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
      
      <div
        className={`h-screen bg-sidebar-background transition-all duration-300 flex flex-col ${
          isCollapsed ? "w-16" : "w-80"
        } ${isMobile ? "fixed right-0 z-40" : ""} ${
          !(isMobile && isCollapsed) ? (isMobile ? "border-l border-sidebar-border" : "border-r border-sidebar-border") : ""
        } ${isMobile && isCollapsed ? "translate-x-full" : ""}`}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-xl font-semibold text-sidebar-foreground">
              {isAuthenticated ? "내 요약 기록" : "최근 요약"}
            </h2>
          )}
          {!isMobile && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-sidebar-muted-foreground">
              {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          )}
        </div>
        
        {/* Auth & Controls */}
        <div className="px-4 mb-2 flex items-center justify-between">
          {!isCollapsed && <AuthButton />}
          <div className="flex items-center gap-1">
            {isCollapsed && <ThemeToggle />}
            <Button 
              variant="ghost" 
              size={isCollapsed ? "icon" : "default"} 
              onClick={handleRefresh} 
              disabled={summariesLoading}
              className="text-sidebar-muted-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${summariesLoading ? 'animate-spin' : ''}`} />
              {!isCollapsed && <span className="ml-2">새로고침</span>}
            </Button>
          </div>
        </div>

        {/* Usage tracker for authenticated users */}
        {!isCollapsed && isAuthenticated && <UsageTracker />}

        {/* Status info */}
        {!isCollapsed && (
          <p className="px-4 text-xs text-sidebar-muted-foreground mb-2">
            {isAuthenticated 
              ? "개인 요약 기록이 표시됩니다." 
              : "모든 사용자의 요약 기록이 표시됩니다."
            }
          </p>
        )}
        
        <Separator className="bg-sidebar-border" />

        {/* Loading state */}
        {isInitialLoading && (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-sidebar-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {error && !isInitialLoading && (
          <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
            <FileText className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-red-600 font-semibold mb-2">오류 발생</p>
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <Button onClick={handleRefresh} size="sm" variant="outline">
              다시 시도
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!isInitialLoading && !error && summaries.length === 0 && (
          <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
            <FileText className="h-12 w-12 text-sidebar-muted-foreground mb-4" />
            <p className="text-sidebar-foreground font-semibold">요약된 비디오 없음</p>
            <p className="text-sm text-sidebar-muted-foreground">
              {isAuthenticated 
                ? "아직 요약한 비디오가 없습니다. 새 비디오를 요약해보세요!"
                : "요약된 비디오가 없습니다."}
            </p>
          </div>
        )}

        {/* Summaries list with infinite scroll */}
        {!isInitialLoading && !error && summaries.length > 0 && (
          <ScrollArea className="flex-grow">
            <InfiniteScroll
              hasNextPage={hasNextPage}
              loading={summariesLoading}
              loadNext={loadNextPage}
              className="p-2 space-y-1"
            >
              {summaries.map((summary: Summary) => (
                <Link
                  key={summary.video_id}
                  href={`/?videoId=${summary.video_id}`}
                  onClick={() => {
                    if (isMobile) {
                      setIsCollapsed(true);
                    }
                  }}
                  className={`group flex items-center p-2 rounded-md transition-colors ${
                    currentVideoId === summary.video_id
                      ? "bg-sidebar-active-background text-sidebar-active-foreground"
                      : "hover:bg-sidebar-hover-background text-sidebar-foreground"
                  }`}
                >
                  <img 
                    src={summary.thumbnail_url || '/placeholder-thumbnail.png'}
                    alt={summary.title}
                    className="w-10 h-10 object-cover rounded-md mr-3 flex-shrink-0"
                    onError={(e) => (e.currentTarget.src = '/placeholder-thumbnail.png')}
                  />
                  {!isCollapsed && (
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-medium truncate group-hover:text-sidebar-hover-foreground">
                        {truncateTitle(summary.title, 40)}
                      </h3>
                      <div className="flex items-center text-xs text-sidebar-muted-foreground mt-1">
                        <User className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span className="truncate">
                          {summary.channel_title || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-sidebar-muted-foreground mt-1">
                        <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                        <span>{formatDate(summary.created_at)}</span>
                      </div>
                    </div>
                  )}
                </Link>
              ))}
              
              {/* Loading indicator for next page */}
              {summariesLoading && summaries.length > 0 && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-sidebar-muted-foreground" />
                </div>
              )}
            </InfiniteScroll>
          </ScrollArea>
        )}
        
        {/* Footer */}
        {!isCollapsed && (
          <>
            <Separator className="bg-sidebar-border mt-auto" />
            <div className="p-4 space-y-2">
              {isAuthenticated && (
                <div className="text-xs text-sidebar-muted-foreground mb-2">
                  <p>Plan: <span className="font-semibold capitalize text-primary">{userTier.replace('_', ' ')}</span></p>
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                <ThemeToggle />
                <span className="text-xs text-sidebar-muted-foreground">테마 변경</span>
              </div>
              <Link href="/feedback">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2 text-sidebar-foreground border-sidebar-border hover:bg-sidebar-hover-background"
                  onClick={() => {
                    if (isMobile) {
                      setIsCollapsed(true);
                    }
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Community Feedback
                </Button>
              </Link>
              <div className="text-xs text-sidebar-muted-foreground">
                <p>&copy; {new Date().getFullYear()} YouTube Summarizer</p>
                <p>AI Model: Claude 3.5 Sonnet</p> 
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}