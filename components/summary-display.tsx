"use client"
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useContext } from "react";
import { SummaryDisplayClient } from "@/components/summary-display-client";
import { getSummary, fetchVideoDetailsServer } from "@/app/actions";
import { LoadingContext } from "@/components/youtube-form";
import YouTube, { YouTubePlayer, YouTubeEvent } from "react-youtube";
import { useResetContext } from "@/components/reset-context";
import { useAuth } from "@/components/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

export default function SummaryDisplay() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("videoId");
  const [summary, setSummary] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<any | null>(null);
  const [playerRef, setPlayerRef] = useState<YouTubePlayer | null>(null);
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
      setVideoInfo(videoDetails.items[0]);
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
        await fetchVideoDetails(videoId);
      } else if (retryCountRef.current < 2) {
        // Retry logic
        retryCountRef.current++;
        timeoutRef.current = setTimeout(fetchSummaryWithRetry, 500);
      } else {
        // Even if summary fetch failed, try to get video details
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
      fetchSummaryWithRetry();
    } else {
      setSummary(null);
      setVideoInfo(null);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [videoId, fetchSummaryWithRetry]);
  
  // Function to handle seeking in the video directly in this component
  const handleSeek = (seconds: number) => {
    if (playerRef) {
      playerRef.seekTo(seconds, true);
      playerRef.playVideo();
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
  if (summary === null) return null;
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
                  },
                }}
                onReady={(e: { target: YouTubePlayer }) => {
                  setPlayerRef(e.target);
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
                },
              }}
              onReady={(e: { target: YouTubePlayer }) => {
                setPlayerRef(e.target);
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
