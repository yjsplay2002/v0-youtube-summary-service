"use client"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { SummaryDisplayClient } from "@/components/summary-display-client"
import { getSummary, fetchVideoDetailsServer } from "@/app/actions"

import { useContext } from "react";
import { LoadingContext } from "@/components/youtube-form";
import YouTube, { YouTubePlayer, YouTubeEvent } from "react-youtube";
import { useResetContext } from "@/components/reset-context";

export default function SummaryDisplay() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("videoId");
  const [summary, setSummary] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<any | null>(null);
  const [playerRef, setPlayerRef] = useState<YouTubePlayer | null>(null);
  
  // Get the reset context
  const { registerResetCallback } = useResetContext();

  // Register a callback to reset the summary and video info
  useEffect(() => {
    const resetHandler = () => {
      setSummary(null);
      setVideoInfo(null);
    };
    
    registerResetCallback(resetHandler);
  }, [registerResetCallback]);

  useEffect(() => {
    let retryCount = 0;
    let timeout: NodeJS.Timeout;

    async function fetchSummaryWithRetry() {
      if (videoId) {
        const result = await getSummary(videoId);
        setSummary(result);
        console.log("[SummaryDisplay] Fetched summary:", result);
        console.log("[SummaryDisplay] summary type:", typeof result, "length:", result?.length, "value:", result);
        if ((!result || result.trim() === "") && retryCount < 2) {
          retryCount++;
          timeout = setTimeout(fetchSummaryWithRetry, 500);
        }
        
        // Fetch video details
        try {
          const videoDetails = await fetchVideoDetailsServer(videoId);
          setVideoInfo(videoDetails.items[0]);
        } catch (error) {
          console.error("[SummaryDisplay] Failed to fetch video details:", error);
        }
      } else {
        setSummary(null);
        setVideoInfo(null);
      }
    }
    fetchSummaryWithRetry();
    return () => clearTimeout(timeout);
  }, [videoId]);
  
  // Function to handle seeking in the video directly in this component
  const handleSeek = (seconds: number) => {
    if (playerRef) {
      playerRef.seekTo(seconds, true);
      playerRef.playVideo();
    }
  };

  const loading = useContext(LoadingContext);

  if (!videoId) return null;
  if (loading) return <div>Loading...</div>;
  if (summary === null) return null;
  if (typeof summary === "string" && summary.trim() === "") return <div className="text-center text-muted-foreground">요약이 없습니다.</div>;
  
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
              onReady={(e: YouTubeEvent<any>) => {
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
