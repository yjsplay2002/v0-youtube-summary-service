"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAllSummaries } from "@/app/actions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PanelLeftClose, PanelLeftOpen, FileText, Calendar, User, RefreshCw, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useSummaryContext } from "@/components/summary-context";
import { AuthButton } from "@/components/auth-button";
import { useAuth } from "@/components/auth-context";

// 디바운스 함수 구현
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

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
  const [loading, setLoading] = useState(true); // 초기 로딩 상태 true
  const [refreshing, setRefreshing] = useState(false);
  const { registerRefreshCallback } = useSummaryContext();
  const { user } = useAuth();

  const isLoadingRef = useRef(false); // 실제 fetch 동작 여부
  const initialLoadCompletedForCurrentUserRef = useRef(false); // 현재 사용자에 대한 초기 로드 완료 여부
  const loadSummariesFnRef = useRef<() => void>(() => {}); // context 등록용 함수 ref

  const safeUserId = (id: string | null | undefined): string | undefined => {
    return id || undefined;
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchSummaries = async (userIdToFetchParam?: string | null) => {
    const userIdToFetch = safeUserId(userIdToFetchParam);
    
    if (isLoadingRef.current) {
      console.log(`[Sidebar] fetchSummaries: 이미 로딩 중. 사용자: ${userIdToFetch}. 중단.`);
      return;
    }

    console.log(`[Sidebar] fetchSummaries: 시작. 사용자: ${userIdToFetch}`);
    isLoadingRef.current = true;
    // setLoading(true)는 loadSummaries 또는 메인 useEffect에서 관리

    try {
      const data = await getAllSummaries(userIdToFetch);
      setSummaries(data);
      console.log(`[Sidebar] fetchSummaries: 성공. ${data.length}개 항목. 사용자: ${userIdToFetch}`);
      initialLoadCompletedForCurrentUserRef.current = true; // 현재 사용자에 대한 로드 성공적 완료
    } catch (error) {
      console.error("[Sidebar] fetchSummaries: 오류.", error);
      initialLoadCompletedForCurrentUserRef.current = false; // 오류 발생 시, 다음 시도 허용
    } finally {
      isLoadingRef.current = false;
      setLoading(false); // 항상 로딩 스피너 숨김
      setRefreshing(false); // 새로고침 상태 초기화
      console.log(`[Sidebar] fetchSummaries: 완료. 사용자: ${userIdToFetch}`);
    }
  };

  const debouncedFetchSummaries = useCallback(
    debounce((userId?: string) => fetchSummaries(userId), 300),
    [] 
  );

  const loadSummaries = useCallback(() => {
    const currentSafeUser = safeUserId(user?.id);
    console.log(`[Sidebar] loadSummaries: 호출됨. 현재 사용자: ${currentSafeUser}, 초기 로드 완료 여부: ${initialLoadCompletedForCurrentUserRef.current}`);

    if (!initialLoadCompletedForCurrentUserRef.current) {
      console.log(`[Sidebar] loadSummaries: 요약 로드 진행. 사용자: ${currentSafeUser}`);
      setLoading(true); // 디바운스 호출 전에 로딩 상태 설정
      debouncedFetchSummaries(currentSafeUser);
    } else {
      console.log(`[Sidebar] loadSummaries: 요약 로드 건너뜀. 사용자: ${currentSafeUser}. 이미 로드됨.`);
      setLoading(false); // 이미 로드된 상태이므로 로딩 스피너 확실히 숨김
    }
  }, [user?.id, debouncedFetchSummaries]);

  useEffect(() => {
    loadSummariesFnRef.current = loadSummaries;
  }, [loadSummaries]);

  // 사용자 변경 또는 초기 마운트 시 실행되는 메인 Effect
  useEffect(() => {
    console.log(`[Sidebar] 사용자 변경/마운트 Effect. 사용자: ${user?.id}.`);
    initialLoadCompletedForCurrentUserRef.current = false; // 새 사용자/초기 상태이므로 로드 필요
    setSummaries([]); // 이전 사용자 데이터 클리어
    setLoading(true);   // 새 사용자 상태에 대한 로딩 시작 표시
    loadSummaries();    // 데이터 로드 시도
  }, [user?.id, loadSummaries]); // loadSummaries가 user?.id에 의존하므로 포함

  // Context를 통한 새로고침 콜백 함수
  const refreshCallback = useCallback(() => {
    console.log('[Sidebar] Context 새로고침 요청 받음.');
    setRefreshing(true);
    initialLoadCompletedForCurrentUserRef.current = false; // 강제 새로고침
    if (loadSummariesFnRef.current) {
      loadSummariesFnRef.current();
    }
  }, []);

  // Context를 통한 새로고침 콜백 등록 (한 번만 실행)
  useEffect(() => {
    registerRefreshCallback(refreshCallback);
  }, [registerRefreshCallback, refreshCallback]); 

  const handleRefresh = () => {
    console.log('[Sidebar] 수동 새로고침 버튼 클릭.');
    setRefreshing(true);
    initialLoadCompletedForCurrentUserRef.current = false; // 강제 새로고침
    loadSummaries(); 
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
          className="fixed inset-0 bg-black z-30"
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
        <div className="p-4 flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-xl font-semibold text-sidebar-foreground">
              {user?.id ? "내 요약 기록" : "최근 요약 (20개)"}
            </h2>
          )}
          {!isMobile && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-sidebar-muted-foreground">
              {isCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          )}
        </div>
        
        <div className="px-4 mb-2 flex items-center justify-between">
          {!isCollapsed && <AuthButton />}
          <Button variant="ghost" size={isCollapsed ? "icon" : "default"} onClick={handleRefresh} disabled={refreshing || (loading && !refreshing)} className="text-sidebar-muted-foreground">
            <RefreshCw className={`h-4 w-4 ${(refreshing || (loading && !refreshing)) ? 'animate-spin' : ''}`} />
            {!isCollapsed && <span className="ml-2">새로고침</span>}
          </Button>
        </div>

        {!isCollapsed && (
          <p className="px-4 text-xs text-sidebar-muted-foreground mb-2">
            {user?.id ? "개인 요약 기록이 표시됩니다." : "최신 20개 요약만 표시됩니다."}
          </p>
        )}
        
        <Separator className="bg-sidebar-border" />

        {loading && !refreshing && (
          <div className="flex-grow flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-sidebar-muted-foreground" />
          </div>
        )}

        {!loading && summaries.length === 0 && (
          <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
            <FileText className="h-12 w-12 text-sidebar-muted-foreground mb-4" />
            <p className="text-sidebar-foreground font-semibold">요약된 비디오 없음</p>
            <p className="text-sm text-sidebar-muted-foreground">
              {user?.id 
                ? "아직 요약한 비디오가 없습니다. 새 비디오를 요약해보세요!"
                : "최근 20개의 요약된 비디오가 없습니다."}
            </p>
          </div>
        )}

        {!loading && summaries.length > 0 && (
          <ScrollArea className="flex-grow">
            <div className="p-2 space-y-1">
              {summaries.map((summary) => (
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
                        {truncateTitle(summary.title, isCollapsed ? 10 : 40)}
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
            </div>
          </ScrollArea>
        )}
        
        {!isCollapsed && (
          <>
            <Separator className="bg-sidebar-border mt-auto" />
            <div className="p-4 space-y-2">
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
