"use client"
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useContext } from "react";
import { SummaryDisplayClient } from "@/components/summary-display-client";
import { getSummary, fetchVideoDetailsServer } from "@/app/actions";
import { LoadingContext } from "@/components/youtube-form";
import YouTube, { YouTubePlayer } from "react-youtube";
import { useResetContext } from "@/components/reset-context";
import { useAuth } from "@/components/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { generateVideoSummaryStructuredData, injectStructuredData } from "@/app/lib/structured-data";

export default function SummaryDisplay() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("videoId");
  const [summary, setSummary] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<any | null>(null);
  const [playerRef, setPlayerRef] = useState<YouTubePlayer | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const { user } = useAuth();
  
  // Refs to track state without triggering re-renders
  const retryCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get the reset context
  const { registerResetCallback } = useResetContext();
  
  // Memoize the fetch function to prevent unnecessary re-creations
  const fetchVideoDetails = useCallback(async (id: string) => {
    try {
      console.log(`[SummaryDisplay] Fetching video details for: ${id}`);
      const videoDetails = await fetchVideoDetailsServer(id);
      const videoInfo = videoDetails.items[0];
      setVideoInfo(videoInfo);
      
      // Inject structured data for SEO
      if (videoInfo) {
        const structuredData = generateVideoSummaryStructuredData(videoInfo);
        injectStructuredData(structuredData);
      }
    } catch (error) {
      console.error("[SummaryDisplay] Failed to fetch video details:", error);
    }
  }, []);
  
  // Fetch summary with retry logic
  const fetchSummaryWithRetry = useCallback(async () => {
    if (!videoId) {
      setSummary(null);
      setVideoInfo(null);
      return;
    }
    
    try {
      const result = await getSummary(videoId, user?.id);
      setSummary(result);
      
      // Only fetch video details if we have a valid summary
      if (result && result.trim() !== "") {
        setIsRetrying(false);
        await fetchVideoDetails(videoId);
      } else if (retryCountRef.current < 5) { // 게스트 사용자를 위해 재시도 횟수 증가
        // Retry logic - 게스트 사용자의 경우 DB 저장 시간이 더 걸릴 수 있음
        retryCountRef.current++;
        setIsRetrying(true);
        const retryDelay = Math.min(1000 * retryCountRef.current, 3000); // 점진적 지연 (최대 3초)
        timeoutRef.current = setTimeout(fetchSummaryWithRetry, retryDelay);
      } else {
        // 최종적으로 실패한 경우에도 비디오 정보는 가져오기
        setIsRetrying(false);
        await fetchVideoDetails(videoId);
      }
    } catch (error) {
      console.error("[SummaryDisplay] Error in fetchSummaryWithRetry:", error);
      // Even if summary fetch failed, try to get video details
      if (videoId) {
        await fetchVideoDetails(videoId);
      }
    }
  }, [videoId, user?.id, fetchVideoDetails]);
  
  // Register a callback to reset the summary and video info
  useEffect(() => {
    const resetHandler = () => {
      setSummary(null);
      setVideoInfo(null);
      setIsRetrying(false);
      retryCountRef.current = 0;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    
    registerResetCallback(resetHandler);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [registerResetCallback]);
  
  // Fetch data when videoId changes
  useEffect(() => {
    if (videoId) {
      retryCountRef.current = 0;
      setIsRetrying(false);
      fetchSummaryWithRetry();
    } else {
      setSummary(null);
      setVideoInfo(null);
      setIsRetrying(false);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [videoId, user?.id]); // fetchSummaryWithRetry 의존성 제거
  
  // Function to handle seeking in the video directly in this component
  const handleSeek = (seconds: number) => {
    console.log(`[SummaryDisplay] 비디오 플레이어 시크: ${seconds}초`);
    if (playerRef) {
      try {
        playerRef.seekTo(seconds, true);
        playerRef.playVideo();
        console.log(`[SummaryDisplay] 비디오 플레이어 시크 성공: ${seconds}초`);
        
        // 타임스탬프를 분:초 형식으로 표시
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const timeStr = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        
        // 간단한 토스트 메시지 (선택사항)
        if (typeof window !== 'undefined') {
          console.log(`[SummaryDisplay] ${timeStr}로 이동했습니다`);
        }
      } catch (error) {
        console.error(`[SummaryDisplay] 비디오 플레이어 시크 실패:`, error);
      }
    } else {
      console.warn(`[SummaryDisplay] 비디오 플레이어가 준비되지 않았습니다`);
    }
  };

  const loading = useContext(LoadingContext);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="aspect-video w-full rounded-md" />
      </div>
    );
  }
  
  if (!videoId) return null;
  
  // 재시도 중이거나 summary가 null인 경우 로딩 표시
  if (summary === null || isRetrying) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">
              {isRetrying ? `요약을 불러오는 중... (${retryCountRef.current}/5)` : "요약을 준비하고 있습니다..."}
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (typeof summary === "string" && summary.trim() === "") {
    return (
      <div className="space-y-4">
        {videoInfo ? (
          <>
            <h1 className="text-2xl font-bold">{videoInfo.snippet.title}</h1>
            <p className="text-muted-foreground">{videoInfo.snippet.channelTitle}</p>
            <div className="aspect-video w-full">
              <YouTube
                videoId={videoId}
                className="w-full h-full rounded"
                iframeClassName="w-full h-full rounded"
                opts={{
                  width: '100%',
                  height: '100%',
                  playerVars: {
                    rel: 0,
                    modestbranding: 1,
                    enablejsapi: 1,
                    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
                  },
                }}
                onReady={(e: { target: YouTubePlayer }) => {
                  try {
                    setPlayerRef(e.target);
                  } catch (error) {
                    console.debug('YouTube player ready - CORS error ignored:', error);
                  }
                }}
                onError={(error) => {
                  console.debug('YouTube player error ignored:', error);
                }}
              />
            </div>
          </>
        ) : null}
        <div className="text-center text-muted-foreground py-8">
          이 비디오에 대한 요약이 없습니다.
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Video Player and Info */}
      {videoInfo && (
        <div className="w-full border rounded p-3 bg-muted/40">
          <div className="font-semibold mb-1">{videoInfo.snippet.title}</div>
          <div className="mb-2 text-xs text-muted-foreground">{videoInfo.snippet.channelTitle}</div>
          <div className="w-full aspect-video rounded overflow-hidden">
            <YouTube
              videoId={videoInfo.id}
              className="w-full h-full rounded"
              iframeClassName="w-full h-full rounded"
              opts={{
                width: '100%',
                height: '100%',
                playerVars: {
                  rel: 0,
                  modestbranding: 1,
                  enablejsapi: 1,
                  origin: typeof window !== 'undefined' ? window.location.origin : undefined,
                },
              }}
              onReady={(e: { target: YouTubePlayer }) => {
                try {
                  setPlayerRef(e.target);
                } catch (error) {
                  console.debug('YouTube player ready - CORS error ignored:', error);
                }
              }}
              onError={(error) => {
                console.debug('YouTube player error ignored:', error);
              }}
            />
          </div>
        </div>
      )}
      
      {/* Summary */}
      <SummaryDisplayClient summary={summary} seekTo={handleSeek} />
    </div>
  );
}
