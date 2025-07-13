"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState, useCallback, useRef } from "react"
import { SummaryDisplayClient } from "@/components/summary-display"
import { getSummary, fetchVideoDetailsServer } from "@/app/actions"
import { useAuth } from "@/components/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import YouTube, { YouTubePlayer } from "react-youtube"
import { generateVideoSummaryStructuredData, injectStructuredData } from "@/app/lib/structured-data"
import { SUPPORTED_LANGUAGES } from "@/components/language-selector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useVideoLanguages } from "@/hooks/use-video-languages"

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
  const language = searchParams.get("language") || 'en'
  const autoplay = searchParams.get("autoplay") === "true"
  const [allSummaries, setAllSummaries] = useState<AllSummariesData | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [currentLanguage, setCurrentLanguage] = useState<string>(language)
  const [videoInfo, setVideoInfo] = useState<any | null>(null)
  const [playerRef, setPlayerRef] = useState<YouTubePlayer | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { user, loading: authLoading } = useAuth()
  
  // Use shared video languages hook to prevent duplicate API calls
  const { languages: availableLanguages, isLoading: isLoadingLanguages, refreshLanguages } = useVideoLanguages(videoId)

  // Track which videoId has been fetched to prevent duplicate API calls
  const fetchedVideoIds = useRef(new Set<string>())
  
  // Track active summary requests to prevent duplicates
  const activeSummaryRequests = useRef(new Map<string, Promise<AllSummariesData | null>>())

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
  const handleSummaryLanguageChange = (language: string, newSummary: string) => {
    console.log(`[SimpleSummaryContainer] 언어 변경: ${currentLanguage} -> ${language}`)
    setCurrentLanguage(language)
    setSummary(newSummary)
  }

  // Fetch all summaries for a video with duplicate request prevention
  const fetchAllSummaries = useCallback(async (videoId: string, userId?: string, language?: string): Promise<AllSummariesData | null> => {
    const requestKey = `${videoId}-${userId || 'no-user'}-${language || 'no-lang'}`
    
    // Check if there's already an active request for this combination
    if (activeSummaryRequests.current.has(requestKey)) {
      console.log(`[SimpleSummaryContainer] 요약 요청 중복 방지: ${requestKey}`)
      return activeSummaryRequests.current.get(requestKey)!
    }
    
    const requestPromise = (async () => {
      try {
        const url = `/api/video-summaries?videoId=${encodeURIComponent(videoId)}${userId ? `&userId=${encodeURIComponent(userId)}` : ''}${language ? `&language=${encodeURIComponent(language)}` : ''}`
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
      } finally {
        // Remove from active requests when done
        activeSummaryRequests.current.delete(requestKey)
      }
    })()
    
    // Store the promise to prevent duplicate requests
    activeSummaryRequests.current.set(requestKey, requestPromise)
    
    return requestPromise
  }, [])

  // Languages are now handled by the useVideoLanguages hook automatically

  // Handle language change and load summary for that language
  const handleLanguageChange = async (selectedLanguage: string) => {
    if (!videoId || selectedLanguage === currentLanguage) return

    console.log(`[SimpleSummaryContainer] 언어 변경: ${currentLanguage} -> ${selectedLanguage}`)
    setCurrentLanguage(selectedLanguage)

    // Update URL parameters
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('videoId', videoId)
    newUrl.searchParams.set('language', selectedLanguage)
    window.history.replaceState({}, '', newUrl.pathname + newUrl.search)

    // Fetch summaries for the new language
    setIsLoading(true)
    try {
      const allSummariesData = await fetchAllSummaries(videoId, user?.id, selectedLanguage)
      setAllSummaries(allSummariesData)
      
      // Set primary summary
      if (allSummariesData?.mySummary) {
        setSummary(allSummariesData.mySummary.summary)
      } else if (allSummariesData?.otherSummaries.length > 0) {
        setSummary(allSummariesData.otherSummaries[0].summary)
      } else {
        setSummary(null)
      }
    } catch (error) {
      console.error('[SimpleSummaryContainer] Error loading summary for language:', error)
      setSummary(null)
      setAllSummaries(null)
    } finally {
      setIsLoading(false)
    }
  }

  // Update current language when URL parameter changes
  useEffect(() => {
    setCurrentLanguage(language)
  }, [language])

  // Languages are automatically fetched by useVideoLanguages hook when videoId changes

  // Handle new summary creation (refresh available languages)
  const handleNewSummaryCreated = useCallback(() => {
    console.log('[SimpleSummaryContainer] 새 요약 생성됨, 사용 가능한 언어 새로고침')
    if (videoId) {
      refreshLanguages(videoId)
    }
  }, [videoId, refreshLanguages])

  // Get language display name
  const getLanguageDisplayName = (langCode: string) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode)
    return lang ? `${lang.nativeName} (${lang.name})` : langCode
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

  // Fetch video details (with duplicate prevention)
  useEffect(() => {
    if (!videoId) {
      setVideoInfo(null)
      // Clear the cache when no videoId
      fetchedVideoIds.current.clear()
      return
    }

    // Prevent duplicate fetches for the same videoId
    if (fetchedVideoIds.current.has(videoId)) {
      console.log(`[SimpleSummaryContainer] 비디오 정보 이미 패칭됨 (캐시됨): ${videoId}`)
      return
    }

    const fetchVideoInfo = async () => {
      console.log(`[SimpleSummaryContainer] 비디오 정보 패칭 시작: ${videoId}`)
      
      // Mark as being fetched to prevent concurrent requests
      fetchedVideoIds.current.add(videoId)
      
      try {
        const videoDetails = await fetchVideoDetailsServer(videoId)
        const videoInfo = videoDetails?.items?.[0]
        console.log("[SimpleSummaryContainer] Video details fetched:", {
          hasVideoInfo: !!videoInfo,
          title: videoInfo?.snippet?.title
        })
        setVideoInfo(videoInfo)

        // Inject structured data for SEO
        if (videoInfo) {
          const structuredData = generateVideoSummaryStructuredData(videoInfo)
          injectStructuredData(structuredData)
        }
      } catch (error) {
        console.error("[SimpleSummaryContainer] Error fetching video details:", error)
        setVideoInfo(null)
        // Remove from cache on error so it can be retried
        fetchedVideoIds.current.delete(videoId)
      }
    }

    fetchVideoInfo()
  }, [videoId])

  // Fetch existing summary (인증 완료 후) - currentLanguage 의존성 제거하여 중복 호출 방지
  useEffect(() => {
    if (!videoId) {
      setSummary(null)
      return
    }

    // 인증이 아직 로딩 중이면 대기
    if (authLoading) {
      console.log("[SimpleSummaryContainer] 인증 로딩 중 - 대기")
      return
    }

    const fetchSummaryData = async () => {
      console.log("[SimpleSummaryContainer] 인증 완료 후 요약 데이터 패칭 시작:", {
        videoId,
        userId: user?.id,
        authLoading,
        currentLanguage
      })
      setIsLoading(true)
      try {
        // Get all summaries (including mine and others) for current language
        const allSummariesData = await fetchAllSummaries(videoId, user?.id, currentLanguage)
        console.log("[SimpleSummaryContainer] All summaries fetched:", allSummariesData)

        setAllSummaries(allSummariesData)

        // Set primary summary (mine if available, otherwise the latest other summary)
        if (allSummariesData?.mySummary) {
          setSummary(allSummariesData.mySummary.summary)
        } else if (allSummariesData?.otherSummaries.length > 0) {
          setSummary(allSummariesData.otherSummaries[0].summary)
        } else {
          setSummary(null)
        }
      } catch (error) {
        console.error("[SimpleSummaryContainer] Error fetching summary data:", error)
        setAllSummaries(null)
        setSummary(null)
      } finally {
        setIsLoading(false)
      }
    }

    // Add a small delay to allow URL changes to settle
    const timeoutId = setTimeout(fetchSummaryData, 100)
    return () => clearTimeout(timeoutId)
  }, [videoId, user?.id, authLoading, fetchAllSummaries])

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
        
        <div className="text-center py-8">
          <div className="text-muted-foreground mb-4">
            선택한 언어({getLanguageDisplayName(currentLanguage)})에 대한 요약이 없습니다.
          </div>
          
          {/* Show available languages if there are any */}
          {availableLanguages.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                다음 언어로 요약을 확인할 수 있습니다:
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">언어 선택:</span>
                <Select
                  value={currentLanguage}
                  onValueChange={handleLanguageChange}
                  disabled={isLoadingLanguages || isLoading}
                >
                  <SelectTrigger className="w-[200px] h-8">
                    <SelectValue>
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>로딩중...</span>
                        </div>
                      ) : (
                        getLanguageDisplayName(currentLanguage)
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((langOption) => (
                      <SelectItem key={langOption.language} value={langOption.language}>
                        <div className="flex flex-col">
                          <span>{getLanguageDisplayName(langOption.language)}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(langOption.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          {availableLanguages.length === 0 && !isLoadingLanguages && (
            <div className="text-muted-foreground">
              이 비디오에 대한 요약이 전혀 없습니다.
            </div>
          )}
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
                    onLanguageChange={handleSummaryLanguageChange}
          onNewSummaryCreated={handleNewSummaryCreated}
                    onNewSummaryCreated={handleNewSummaryCreated}
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
                    onLanguageChange={handleSummaryLanguageChange}
          onNewSummaryCreated={handleNewSummaryCreated}
                    onNewSummaryCreated={handleNewSummaryCreated}
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
                      onLanguageChange={handleSummaryLanguageChange}
          onNewSummaryCreated={handleNewSummaryCreated}
                    onNewSummaryCreated={handleNewSummaryCreated}
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
          onLanguageChange={handleSummaryLanguageChange}
          onNewSummaryCreated={handleNewSummaryCreated}
        />
      )}
    </div>
  )
}