"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllSummaries } from "@/app/actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PanelLeftClose, PanelLeftOpen, FileText, Calendar, User, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSummaryContext } from "@/components/summary-context";
import { AuthButton } from "@/components/auth-button";

type Summary = {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  created_at: string;
};

interface SidebarNavigationProps {
  currentVideoId?: string;
}

export function SidebarNavigation({ currentVideoId }: SidebarNavigationProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { registerRefreshCallback } = useSummaryContext();

  // 모바일 화면 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // 모바일에서는 기본적으로 접힌 상태로 시작
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadSummaries = useCallback(async () => {
    try {
      const data = await getAllSummaries();
      setSummaries(data);
    } catch (error) {
      console.error("Failed to load summaries:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSummaries();
    // Register this component's refresh function with the context
    registerRefreshCallback(loadSummaries);
  }, [loadSummaries, registerRefreshCallback]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSummaries();
  };

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

  return (
    <>
      {/* Floating toggle button for mobile */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
          aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      )}
      
      <div
        className={`h-screen bg-sidebar-background transition-all duration-300 flex flex-col ${
          isCollapsed ? "w-16" : "w-80"
        } ${isMobile ? "fixed right-0 z-40" : ""} ${
          !(isMobile && isCollapsed) ? (isMobile ? "border-l border-sidebar-border" : "border-r border-sidebar-border") : ""
        } ${isMobile && isCollapsed ? "translate-x-full" : ""}`}
      >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold text-sidebar-foreground">
              요약 기록
            </h2>
          )}
          <div className="flex items-center gap-2">
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 hover:bg-sidebar-accent text-sidebar-foreground"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
            )}
            {!isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="p-2 hover:bg-sidebar-accent text-sidebar-foreground"
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content - 모바일에서 접힌 상태일 때는 콘텐츠 숨기기 */}
      {!(isMobile && isCollapsed) && (
        <>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {/* New Summary Button */}
              <Link
                href="/"
                className={`block w-full p-3 mb-4 rounded-lg hover:bg-sidebar-accent transition-colors border-2 border-dashed border-sidebar-border hover:border-sidebar-primary ${
                  !currentVideoId ? "bg-sidebar-accent border-sidebar-primary" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-9 bg-sidebar-primary/10 rounded flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-sidebar-primary" />
                  </div>
                  {!isCollapsed && (
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-sidebar-foreground">
                        새로운 요약
                      </h3>
                      <p className="text-xs text-sidebar-foreground/60">
                        YouTube 링크 입력
                      </p>
                    </div>
                  )}
                </div>
              </Link>

              {/* Separator */}
              {!isCollapsed && summaries.length > 0 && (
                <div className="px-3 mb-4">
                  <Separator className="bg-sidebar-border" />
                </div>
              )}

              {loading ? (
                <div className="p-4 text-center text-sidebar-foreground/60">
                  {!isCollapsed ? "로딩 중..." : "..."}
                </div>
              ) : summaries.length === 0 ? (
                <div className="p-4 text-center text-sidebar-foreground/60">
                  {!isCollapsed ? "요약된 동영상이 없습니다" : ""}
                </div>
              ) : (
                <div className="space-y-2">
                  {summaries.map((summary) => (
                    <Link
                      key={summary.video_id}
                      href={`/?videoId=${summary.video_id}`}
                      className={`block w-full p-3 rounded-lg hover:bg-sidebar-accent transition-colors ${
                        currentVideoId === summary.video_id
                          ? "bg-sidebar-accent border border-sidebar-primary"
                          : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 모바일에서 접힌 상태일 때는 썸네일 숨기기 */}
                        {!(isMobile && isCollapsed) && (
                          summary.thumbnail_url ? (
                            <img
                              src={summary.thumbnail_url}
                              alt={summary.title}
                              className="w-12 h-9 object-cover rounded flex-shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-12 h-9 bg-sidebar-accent rounded flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-sidebar-foreground/60" />
                            </div>
                          )
                        )}
                        
                        {/* 모바일에서 접힌 상태일 때는 아이콘만 표시 */}
                        {isMobile && isCollapsed && (
                          <div className="w-12 h-9 bg-sidebar-accent rounded flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-sidebar-foreground/60" />
                          </div>
                        )}
                        
                        {!isCollapsed && (
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-sidebar-foreground line-clamp-2 leading-tight">
                              {truncateTitle(summary.title)}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-xs text-sidebar-foreground/70">
                              <User className="w-3 h-3" />
                              <span className="truncate">{summary.channel_title}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-sidebar-foreground/60">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(summary.created_at)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border space-y-3">
            <div className="flex justify-center">
              <AuthButton />
            </div>
            {!isCollapsed && (
              <p className="text-xs text-sidebar-foreground/60 text-center">
                총 {summaries.length}개의 요약
              </p>
            )}
          </div>
        </>
      )}
      </div>
    </>
  );
}
