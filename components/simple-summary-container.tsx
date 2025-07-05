"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { SummaryDisplayClient } from "@/components/summary-display"
import { getSummary, fetchVideoDetailsServer } from "@/app/actions"
import { useAuth } from "@/components/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import YouTube, { YouTubePlayer } from "react-youtube"
import { generateVideoSummaryStructuredData, injectStructuredData } from "@/app/lib/structured-data"

export default function SimpleSummaryContainer() {
  const searchParams = useSearchParams()
  const videoId = searchParams.get("videoId")
  const [summary, setSummary] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<any | null>(null)
  const [playerRef, setPlayerRef] = useState<YouTubePlayer | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { user, loading: authLoading } = useAuth()

  // Simple function to handle seeking in the video
  const handleSeek = (seconds: number) => {
    console.log(`[SimpleSummaryContainer] 비디오 플레이어 시크: ${seconds}초`)
    if (playerRef) {
      try {
        playerRef.seekTo(seconds, true)
        playerRef.playVideo()
        console.log(`[SimpleSummaryContainer] 비디오 플레이어 시크 성공: ${seconds}초`)
      } catch (error) {
        console.error(`[SimpleSummaryContainer] 비디오 플레이어 시크 실패:`, error)
      }
    } else {
      console.warn(`[SimpleSummaryContainer] 비디오 플레이어가 준비되지 않았습니다`)
    }
  }

  // Fetch existing summary and video details (인증 완료 후)
  useEffect(() => {
    if (!videoId) {
      setSummary(null)
      setVideoInfo(null)
      return
    }

    // 인증이 아직 로딩 중이면 대기
    if (authLoading) {
      console.log("[SimpleSummaryContainer] 인증 로딩 중 - 대기")
      return
    }

    const fetchData = async () => {
      console.log("[SimpleSummaryContainer] 인증 완료 후 데이터 패칭 시작:", { 
        videoId, 
        userId: user?.id, 
        authLoading 
      })
      setIsLoading(true)
      try {
        // 1. Get existing summary
        const existingSummary = await getSummary(videoId, user?.id)
        console.log("[SimpleSummaryContainer] Summary fetched:", { 
          hasExistingSummary: !!existingSummary,
          summaryLength: existingSummary?.length 
        })
        
        // 2. Get video details
        const videoDetails = await fetchVideoDetailsServer(videoId)
        const videoInfo = videoDetails?.items?.[0]
        console.log("[SimpleSummaryContainer] Video details fetched:", { 
          hasVideoInfo: !!videoInfo,
          title: videoInfo?.snippet?.title 
        })
        
        // 3. Set states
        setSummary(existingSummary || null)
        setVideoInfo(videoInfo)
        
        // 4. Inject structured data for SEO
        if (videoInfo) {
          const structuredData = generateVideoSummaryStructuredData(videoInfo)
          injectStructuredData(structuredData)
        }
      } catch (error) {
        console.error("[SimpleSummaryContainer] Error fetching data:", error)
        setSummary(null)
        setVideoInfo(null)
      } finally {
        setIsLoading(false)
      }
    }

    // Add a small delay to allow URL changes to settle
    const timeoutId = setTimeout(fetchData, 100)
    return () => clearTimeout(timeoutId)
  }, [videoId, user?.id, authLoading])

  // Listen for summary update events
  useEffect(() => {
    const handleSummaryUpdated = async (event: CustomEvent) => {
      const { videoId: updatedVideoId } = event.detail
      console.log("[SimpleSummaryContainer] Summary updated event received:", { 
        updatedVideoId, 
        currentVideoId: videoId,
        isMatch: updatedVideoId === videoId 
      })
      
      // Always refresh if event is received, regardless of videoId match
      // This handles cases where the URL might be updating
      console.log("[SimpleSummaryContainer] Refreshing summary after update event")
      setIsLoading(true)
      try {
        // Use the updated videoId from the event if available, otherwise current videoId
        const targetVideoId = updatedVideoId || videoId
        if (targetVideoId) {
          const existingSummary = await getSummary(targetVideoId, user?.id)
          setSummary(existingSummary || null)
          console.log("[SimpleSummaryContainer] Summary refreshed successfully for:", targetVideoId)
        }
      } catch (error) {
        console.error("[SimpleSummaryContainer] Error refreshing summary:", error)
      } finally {
        setIsLoading(false)
      }
    }

    console.log("[SimpleSummaryContainer] Setting up summaryUpdated event listener for videoId:", videoId)
    window.addEventListener('summaryUpdated', handleSummaryUpdated as EventListener)
    
    return () => {
      console.log("[SimpleSummaryContainer] Removing summaryUpdated event listener")
      window.removeEventListener('summaryUpdated', handleSummaryUpdated as EventListener)
    }
  }, [videoId, user?.id])

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="aspect-video w-full rounded-md" />
      </div>
    )
  }

  // No video ID
  if (!videoId) return null

  // No summary found
  if (!summary || summary.trim() === "") {
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
                    setPlayerRef(e.target)
                  } catch (error) {
                    console.debug('YouTube player ready - CORS error ignored:', error)
                  }
                }}
                onError={(error) => {
                  console.debug('YouTube player error ignored:', error)
                }}
              />
            </div>
          </>
        ) : null}
        <div className="text-center text-muted-foreground py-8">
          이 비디오에 대한 요약이 없습니다.
        </div>
      </div>
    )
  }

  // Show summary
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
                  setPlayerRef(e.target)
                } catch (error) {
                  console.debug('YouTube player ready - CORS error ignored:', error)
                }
              }}
              onError={(error) => {
                console.debug('YouTube player error ignored:', error)
              }}
            />
          </div>
        </div>
      )}
      
      {/* Summary Display */}
      <SummaryDisplayClient summary={summary} seekTo={handleSeek} videoId={videoId} />
    </div>
  )
}