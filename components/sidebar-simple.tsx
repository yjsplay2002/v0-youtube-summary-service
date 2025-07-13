"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  FileText, 
  Calendar, 
  User, 
  RefreshCw, 
  MessageSquare,
  Loader2,
  Plus
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { AuthButton } from "@/components/auth-button";
import { getUserSubscriptionTier } from "@/app/lib/auth-utils";
import { UsageTracker } from "@/components/usage-tracker";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSummaryContext } from "@/components/summary-context";
import { SUPPORTED_LANGUAGES } from "@/components/language-selector";

interface Summary {
  video_id: string;
  title: string;
  thumbnail_url: string;
  channel_title: string;
  created_at: string;
  language: string;
}

interface SidebarSimpleProps {
  currentVideoId?: string;
}

export function SidebarSimple({ currentVideoId }: SidebarSimpleProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const userTier = getUserSubscriptionTier(user);
  const { registerRefreshCallback } = useSummaryContext();
  const router = useRouter();
  
  // 이전 상태를 추적하여 중복 호출 방지
  const prevAuthState = useRef<{isAuthenticated: boolean, userId?: string}>({
    isAuthenticated: false,
    userId: undefined
  });
  const hasInitiallyLoaded = useRef(false);
  const isRequestInProgress = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useRef<HTMLDivElement>(null);

  // 모바일 체크
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

  // 요약 데이터 불러오기 (매개변수로 명시적으로 상태 전달)
  const fetchSummaries = async (forceAuthState?: { isAuthenticated: boolean; userId?: string }, resetPagination: boolean = true) => {
    // 중복 요청 방지
    if (isRequestInProgress.current) {
      console.log('[SidebarSimple] 이미 요청 진행 중 - 스킵');
      return;
    }
    
    const currentAuthState = forceAuthState || { isAuthenticated, userId: user?.id };
    
    console.log('[SidebarSimple] fetchSummaries 시작:', {
      authState: currentAuthState,
      isForced: !!forceAuthState,
      resetPagination
    });
    
    isRequestInProgress.current = true;
    setLoading(true);
    setError(null);
    
    if (resetPagination) {
      setPage(1);
      setHasMore(true);
    }
    
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '20',
      });

      // 로그인한 사용자의 경우 userId 추가
      if (currentAuthState.isAuthenticated && currentAuthState.userId) {
        params.append('userId', currentAuthState.userId);
        console.log('[SidebarSimple] 로그인 사용자 요청:', currentAuthState.userId);
      } else {
        console.log('[SidebarSimple] 게스트 사용자 요청');
      }

      const url = `/api/summaries?${params}`;
      console.log('[SidebarSimple] API 호출:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[SidebarSimple] API 응답:', data);

      setSummaries(data.summaries || []);
      setHasMore(data.pagination?.hasNextPage || false);
      console.log('[SidebarSimple] 요약 데이터 설정 완료:', data.summaries?.length || 0);

    } catch (err) {
      console.error('[SidebarSimple] 에러 발생:', err);
      setError(err instanceof Error ? err.message : '요약 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      isRequestInProgress.current = false;
    }
  };

  // 더 많은 요약 데이터 불러오기 (infinite scroll용)
  const loadMoreSummaries = useCallback(async () => {
    if (loadingMore || !hasMore || isRequestInProgress.current) {
      return;
    }

    const currentAuthState = { isAuthenticated, userId: user?.id };
    const nextPage = page + 1;
    
    console.log('[SidebarSimple] loadMoreSummaries 시작:', {
      authState: currentAuthState,
      nextPage,
      hasMore
    });
    
    setLoadingMore(true);
    
    try {
      const params = new URLSearchParams({
        page: nextPage.toString(),
        limit: '20',
      });

      // 로그인한 사용자의 경우 userId 추가
      if (currentAuthState.isAuthenticated && currentAuthState.userId) {
        params.append('userId', currentAuthState.userId);
      }

      const url = `/api/summaries?${params}`;
      console.log('[SidebarSimple] 더 많은 데이터 API 호출:', url);

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[SidebarSimple] 추가 데이터 API 응답:', data);

      const newSummaries = data.summaries || [];
      if (newSummaries.length > 0) {
        setSummaries(prev => [...prev, ...newSummaries]);
        setPage(nextPage);
        setHasMore(data.pagination?.hasNextPage || false);
        console.log('[SidebarSimple] 추가 요약 데이터 추가 완료:', newSummaries.length);
      } else {
        setHasMore(false);
        console.log('[SidebarSimple] 더 이상 데이터 없음');
      }

    } catch (err) {
      console.error('[SidebarSimple] 추가 데이터 로딩 에러:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [isAuthenticated, user?.id, page, hasMore, loadingMore]);

  // Intersection Observer 설정 (infinite scroll용)
  useEffect(() => {
    if (!lastElementRef.current || loading) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const lastEntry = entries[0];
        if (lastEntry.isIntersecting && hasMore && !loadingMore) {
          console.log('[SidebarSimple] 마지막 요소가 보임 - 더 많은 데이터 로딩');
          loadMoreSummaries();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
      }
    );

    observerRef.current.observe(lastElementRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loading, loadMoreSummaries]);

  // 컴포넌트 마운트 및 사용자 변경 시 데이터 로딩 (인증 완료 후)
  useEffect(() => {
    // 인증이 아직 로딩 중이면 대기
    if (authLoading) {
      console.log('[SidebarSimple] 인증 로딩 중 - 대기');
      return;
    }
    
    const currentState = { isAuthenticated, userId: user?.id };
    const prevState = prevAuthState.current;
    
    // 상태가 실제로 변경되었는지 확인 (또는 초기 로딩이 필요한 경우)
    const hasChanged = 
      !hasInitiallyLoaded.current ||
      prevState.isAuthenticated !== currentState.isAuthenticated ||
      prevState.userId !== currentState.userId;
    
    console.log('[SidebarSimple] useEffect 트리거:', {
      current: currentState,
      previous: prevState,
      hasChanged,
      hasInitiallyLoaded: hasInitiallyLoaded.current,
      authLoading
    });
    
    if (hasChanged) {
      console.log('[SidebarSimple] 인증 완료 후 상태 변경 감지 - 데이터 로딩 시작');
      prevAuthState.current = currentState;
      hasInitiallyLoaded.current = true;
      // 명시적으로 현재 상태를 전달
      fetchSummaries(currentState);
    } else {
      console.log('[SidebarSimple] 상태 변경 없음 - 스킵');
    }
  }, [isAuthenticated, user?.id, authLoading]);

  // 요약 완료 이벤트 리스너 (새 요약이 생성되었을 때 자동 갱신)
  useEffect(() => {
    const handleSummaryUpdated = (event: CustomEvent) => {
      console.log('[SidebarSimple] summaryUpdated 이벤트 수신:', event.detail);
      // 현재 인증 상태를 명시적으로 전달하고 페이지네이션 리셋
      const currentAuthState = { isAuthenticated, userId: user?.id };
      console.log('[SidebarSimple] summaryUpdated 이벤트에서 현재 인증 상태 사용:', currentAuthState);
      setPage(1);
      setHasMore(true);
      setSummaries([]);
      fetchSummaries(currentAuthState, true);
    };

    window.addEventListener('summaryUpdated', handleSummaryUpdated as EventListener);
    
    return () => {
      window.removeEventListener('summaryUpdated', handleSummaryUpdated as EventListener);
    };
  }, [isAuthenticated, user?.id]);

  // SummaryContext의 refresh 콜백 등록
  useEffect(() => {
    const refreshHandler = () => {
      console.log('[SidebarSimple] SummaryContext refresh 콜백 호출');
      // 현재 인증 상태를 명시적으로 전달하고 페이지네이션 리셋
      const currentAuthState = { isAuthenticated, userId: user?.id };
      console.log('[SidebarSimple] SummaryContext refresh에서 현재 인증 상태 사용:', currentAuthState);
      setPage(1);
      setHasMore(true);
      setSummaries([]);
      fetchSummaries(currentAuthState, true);
    };
    
    registerRefreshCallback(refreshHandler);
  }, [registerRefreshCallback, isAuthenticated, user?.id]);

  const handleRefresh = () => {
    console.log('[SidebarSimple] 새로고침 버튼 클릭');
    // 현재 인증 상태를 명시적으로 전달하고 페이지네이션 리셋
    const currentAuthState = { isAuthenticated, userId: user?.id };
    console.log('[SidebarSimple] 새로고침 버튼에서 현재 인증 상태 사용:', currentAuthState);
    setPage(1);
    setHasMore(true);
    setSummaries([]);
    fetchSummaries(currentAuthState, true);
  };

  const handleNewSummary = () => {
    console.log('[SidebarSimple] 새로운 영상 요약하기 버튼 클릭');
    // 메인 페이지의 input field 초기화를 위한 이벤트 발생
    window.dispatchEvent(new CustomEvent('clearVideoInput'));
    // Next.js router를 사용해서 메인 페이지로 이동 (페이지 새로고침 없음)
    router.push('/');
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

  const truncateTitle = (title: string, maxLength: number = 40) => {
    return title.length > maxLength ? `${title.substring(0, maxLength)}...` : title;
  };

  const getLanguageDisplayName = (languageCode: string) => {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
    return language ? language.nativeName : languageCode;
  };

  return (
    <>
      {/* 모바일 토글 버튼 */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center"
          aria-label={isCollapsed ? "Open sidebar" : "Close sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      )}

      {/* 모바일 백드롭 */}
      {isMobile && !isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-30"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
      
      <div
        className={`h-screen bg-sidebar-background sidebar-opaque transition-all duration-300 flex flex-col ${
          isCollapsed ? "w-16" : "w-80"
        } ${isMobile ? "fixed right-0 z-40" : ""} ${
          !(isMobile && isCollapsed) ? (isMobile ? "border-l border-sidebar-border" : "border-r border-sidebar-border") : ""
        } ${isMobile && isCollapsed ? "translate-x-full" : ""}`}
      >
        {/* 헤더 */}
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
        
        {/* 인증 & 컨트롤 */}
        <div className="px-4 mb-2 space-y-2">
          <div className="flex items-center justify-between">
            {!isCollapsed && <AuthButton />}
            <div className="flex items-center gap-1">
              {isCollapsed && <ThemeToggle />}
              <Button 
                variant="ghost" 
                size={isCollapsed ? "icon" : "default"} 
                onClick={handleRefresh} 
                disabled={loading}
                className="text-sidebar-muted-foreground"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {!isCollapsed && <span className="ml-2">새로고침</span>}
              </Button>
            </div>
          </div>
          
          {/* 새로운 영상 요약하기 버튼 */}
          {!isCollapsed && (
            <Button 
              onClick={handleNewSummary}
              className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              새로운 영상 요약하기
            </Button>
          )}
          
          {isCollapsed && (
            <div className="flex justify-center">
              <Button 
                variant="default"
                size="icon"
                onClick={handleNewSummary}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                title="새로운 영상 요약하기"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* 사용량 추적 */}
        {!isCollapsed && isAuthenticated && <UsageTracker />}

        {/* 상태 정보 */}
        {!isCollapsed && (
          <p className="px-4 text-xs text-sidebar-muted-foreground mb-2">
            {isAuthenticated 
              ? "개인 요약 기록이 표시됩니다." 
              : "모든 사용자의 요약 기록이 표시됩니다."
            }
          </p>
        )}
        
        <Separator className="bg-sidebar-border" />

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-sidebar-muted-foreground" />
          </div>
        )}

        {/* 에러 상태 */}
        {error && !loading && (
          <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
            <FileText className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-red-600 font-semibold mb-2">오류 발생</p>
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <Button onClick={handleRefresh} size="sm" variant="outline">
              다시 시도
            </Button>
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !error && summaries.length === 0 && (
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

        {/* 요약 리스트 */}
        {!loading && !error && summaries.length > 0 && (
          <ScrollArea className="flex-grow" ref={scrollAreaRef}>
            <div className="p-2 space-y-1">
              {summaries.map((summary, index) => (
                <Link
                  key={`${summary.video_id}-${summary.language || 'unknown'}-${index}`}
                  href={`/?videoId=${summary.video_id}&language=${summary.language || 'en'}`}
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
                        {truncateTitle(summary.title)}
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
                        {summary.language && (
                          <span className="ml-2 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                            {getLanguageDisplayName(summary.language)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              ))}
              
              {/* Infinite scroll loading indicator and observer target */}
              {hasMore && (
                <div 
                  ref={lastElementRef}
                  className="flex items-center justify-center p-4"
                >
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-sidebar-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {!isCollapsed && <span className="text-sm">더 많은 요약을 불러오는 중...</span>}
                    </div>
                  )}
                </div>
              )}
              
              {/* End of list indicator */}
              {!hasMore && summaries.length > 20 && !isCollapsed && (
                <div className="flex items-center justify-center p-4">
                  <span className="text-xs text-sidebar-muted-foreground">
                    모든 요약을 불러왔습니다
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
        
        {/* 푸터 */}
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