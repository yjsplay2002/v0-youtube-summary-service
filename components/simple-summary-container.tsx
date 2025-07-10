"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { SummaryDisplayClient } from "@/components/summary-display"
import { getSummary, fetchVideoDetailsServer } from "@/app/actions"
import { useAuth } from "@/components/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import YouTube, { YouTubePlayer } from "react-youtube"
import { generateVideoSummaryStructuredData, injectStructuredData } from "@/app/lib/structured-data"

interface SummaryData {
  summary: string;
  created_at: string;
  isMine: boolean;
  isGuest?: boolean;
  order?: number;
}

interface AllSummariesData {
  videoId: string;
  mySummary?: SummaryData;
  otherSummaries: SummaryData[];
  totalSummaries: number;
  meta: {
    hasMultipleSummaries: boolean;
    canUseExistingSummary: boolean;
    userSpecific: boolean;
    timestamp: string;
  };
}

export default function SimpleSummaryContainer() {
  const searchParams = useSearchParams()
  const videoId = searchParams.get("videoId")
  const autoplay = searchParams.get("autoplay") === "true"
  const [allSummaries, setAllSummaries] = useState<AllSummariesData | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [currentLanguage, setCurrentLanguage] = useState<string>('en')
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

  // Handle language change in summary display
  const handleLanguageChange = (language: string, newSummary: string) => {
    console.log(`[SimpleSummaryContainer] 언어 변경: ${currentLanguage} -> ${language}`)
    setCurrentLanguage(language)
    setSummary(newSummary)
  }

  // Fetch all summaries for a video
  const fetchAllSummaries = async (videoId: string, userId?: string): Promise<AllSummariesData | null> => {
    try {
      const url = `/api/video-summaries?videoId=${encodeURIComponent(videoId)}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`[SimpleSummaryContainer] 모든 요약 조회 결과:`, data)
      return data
    } catch (error) {
      console.error(`[SimpleSummaryContainer] 모든 요약 조회 실패:`, error)
      return null
    }
  }

  // autoplay 파라미터 제거 (한 번만 실행)
  useEffect(() => {
    if (autoplay && videoId) {
      // autoplay 파라미터를 URL에서 제거
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('autoplay')
      window.history.replaceState({}, '', newUrl.pathname + newUrl.search)
    }
  }, [autoplay, videoId])

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
        // 1. Get all summaries (including mine and others)
        const allSummariesData = await fetchAllSummaries(videoId, user?.id)
        console.log("[SimpleSummaryContainer] All summaries fetched:", allSummariesData)
        
        // 2. Get video details
        const videoDetails = await fetchVideoDetailsServer(videoId)
        const videoInfo = videoDetails?.items?.[0]
        console.log("[SimpleSummaryContainer] Video details fetched:", { 
          hasVideoInfo: !!videoInfo,
          title: videoInfo?.snippet?.title 
        })
        
        // 3. Set states
        setAllSummaries(allSummariesData)
        setVideoInfo(videoInfo)
        
        // Set primary summary (mine if available, otherwise the latest other summary)
        if (allSummariesData?.mySummary) {
          setSummary(allSummariesData.mySummary.summary)
          // Set current language from the summary data if available
          if ((allSummariesData.mySummary as any).language) {
            setCurrentLanguage((allSummariesData.mySummary as any).language)
          }
        } else if (allSummariesData?.otherSummaries.length > 0) {
          setSummary(allSummariesData.otherSummaries[0].summary)
          // Set current language from the summary data if available
          if ((allSummariesData.otherSummaries[0] as any).language) {
            setCurrentLanguage((allSummariesData.otherSummaries[0] as any).language)
          }
        } else {
          setSummary(null)
        }
        
        // 4. Inject structured data for SEO
        if (videoInfo) {
          const structuredData = generateVideoSummaryStructuredData(videoInfo)
          injectStructuredData(structuredData)
        }
      } catch (error) {
        console.error("[SimpleSummaryContainer] Error fetching data:", error)
        setAllSummaries(null)
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
      const { videoId: updatedVideoId, action } = event.detail || {}
      console.log("[SimpleSummaryContainer] Summary updated event received:", { 
        updatedVideoId, 
        currentVideoId: videoId,
        action,
        isMatch: updatedVideoId === videoId 
      })
      
      // Always refresh if event is received, regardless of videoId match
      // This handles cases where the URL might be updating
      console.log("[SimpleSummaryContainer] Refreshing all summaries after update event")
      setIsLoading(true)
      
      try {
        // Use the updated videoId from the event if available, otherwise current videoId
        const targetVideoId = updatedVideoId || videoId
        if (targetVideoId) {
          // Add a small delay to ensure database changes have been committed
          await new Promise(resolve => setTimeout(resolve, 200))
          
          const allSummariesData = await fetchAllSummaries(targetVideoId, user?.id)
          console.log("[SimpleSummaryContainer] Refreshed summaries data:", {
            hasMySummary: !!allSummariesData?.mySummary,
            otherSummariesCount: allSummariesData?.otherSummaries?.length || 0,
            action
          })
          
          setAllSummaries(allSummariesData)
          
          // Set primary summary with improved logic
          if (allSummariesData?.mySummary) {
            setSummary(allSummariesData.mySummary.summary)
            if ((allSummariesData.mySummary as any).language) {
              setCurrentLanguage((allSummariesData.mySummary as any).language)
            }
            console.log("[SimpleSummaryContainer] Set summary to user's own summary")
          } else if (allSummariesData?.otherSummaries.length > 0) {
            setSummary(allSummariesData.otherSummaries[0].summary)
            if ((allSummariesData.otherSummaries[0] as any).language) {
              setCurrentLanguage((allSummariesData.otherSummaries[0] as any).language)
            }
            console.log("[SimpleSummaryContainer] Set summary to latest other summary")
          } else {
            setSummary(null)
            console.log("[SimpleSummaryContainer] No summaries found, cleared summary")
          }
          
          console.log("[SimpleSummaryContainer] All summaries refreshed successfully for:", targetVideoId)
        }
      } catch (error) {
        console.error("[SimpleSummaryContainer] Error refreshing summaries:", error)
        // Don't clear existing data on error, just log it
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
                    autoplay: autoplay ? 1 : 0,
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

  // Show summary with tabs for multiple summaries
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
                  autoplay: autoplay ? 1 : 0,
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
      
      {/* Multiple Summaries Display */}
      {allSummaries && allSummaries.totalSummaries > 1 ? (
        <Tabs defaultValue="primary" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="primary">
              {allSummaries.mySummary ? '내 요약' : '최신 요약'}
            </TabsTrigger>
            <TabsTrigger value="others">
              다른 요약들 ({allSummaries.otherSummaries.length}개)
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="primary" className="mt-4">
            {allSummaries.mySummary ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="default">내 요약</Badge>
                    <span className="text-sm font-normal text-muted-foreground">
                      {new Date(allSummaries.mySummary.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SummaryDisplayClient 
                    summary={allSummaries.mySummary.summary} 
                    seekTo={handleSeek} 
                    videoId={videoId}
                    currentLanguage={currentLanguage}
                    onLanguageChange={handleLanguageChange}
                  />
                </CardContent>
              </Card>
            ) : allSummaries.otherSummaries.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant={allSummaries.otherSummaries[0].isGuest ? "secondary" : "outline"}>
                      {allSummaries.otherSummaries[0].isGuest ? '게스트 요약' : '다른 사용자 요약'}
                    </Badge>
                    <span className="text-sm font-normal text-muted-foreground">
                      {new Date(allSummaries.otherSummaries[0].created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    AI API를 다시 호출하지 않고 기존 요약 결과를 보여드립니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SummaryDisplayClient 
                    summary={allSummaries.otherSummaries[0].summary} 
                    seekTo={handleSeek} 
                    videoId={videoId}
                    currentLanguage={currentLanguage}
                    onLanguageChange={handleLanguageChange}
                  />
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
          
          <TabsContent value="others" className="mt-4">
            <div className="space-y-4">
              {allSummaries.otherSummaries.map((summaryData, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant={summaryData.isGuest ? "secondary" : "outline"}>
                        {summaryData.isGuest ? '게스트 요약' : '다른 사용자 요약'} #{summaryData.order}
                      </Badge>
                      <span className="text-sm font-normal text-muted-foreground">
                        {new Date(summaryData.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SummaryDisplayClient 
                      summary={summaryData.summary} 
                      seekTo={handleSeek} 
                      videoId={videoId}
                      currentLanguage={currentLanguage}
                      onLanguageChange={handleLanguageChange}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        // Single summary display (existing behavior)
        <SummaryDisplayClient 
          summary={summary} 
          seekTo={handleSeek} 
          videoId={videoId}
          currentLanguage={currentLanguage}
          onLanguageChange={handleLanguageChange}
        />
      )}
    </div>
  )
}