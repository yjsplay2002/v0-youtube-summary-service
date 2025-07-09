"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle } from "lucide-react"
import { summarizeYoutubeVideo, fetchVideoDetailsServer, resummarizeYoutubeVideo } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter, useSearchParams } from "next/navigation"
import type { AIModel, PromptType } from "@/app/lib/summary"
import { extractYoutubeVideoId } from "./youtube-form-utils"
import { VideoPlayerProvider } from "@/components/VideoPlayerContext"
import { createContext } from "react"
import { useSummaryContext } from "@/components/summary-context"
import { useResetContext } from "@/components/reset-context"
import { useAuth } from "@/components/auth-context"
import { getAvailableModels, getDefaultModel, isUserAdmin, getUserSubscriptionTier, getSubscriptionLimits } from "@/app/lib/auth-utils"
import { supabase } from "@/app/lib/supabase"
import { LanguageSelector, type SupportedLanguage } from "@/components/language-selector"

export const LoadingContext = createContext(false)

export function SimpleYoutubeForm() {
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<any | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [summaryExists, setSummaryExists] = useState(false)
  const [summaryState, setSummaryState] = useState<{
    hasMySummary: boolean;
    hasOtherSummary: boolean;
    otherSummaryInfo?: { isGuest: boolean; created_at: string; };
  }>({
    hasMySummary: false,
    hasOtherSummary: false
  })
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini-2.5-flash')
  const selectedPromptType: PromptType = 'general_summary' // Always use default summary style
  const [isSpecialUser, setIsSpecialUser] = useState(false)
  const [availableModels, setAvailableModels] = useState<AIModel[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en')
  
  // 이전 상태를 추적하여 중복 호출 방지
  const prevUserState = useRef<{user?: any, authLoading: boolean}>({
    user: undefined,
    authLoading: true
  })
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { refreshSummaries } = useSummaryContext()
  const { registerResetCallback } = useResetContext()

  // Initialize form with URL parameters if present
  useEffect(() => {
    const videoId = searchParams.get("videoId")
    const language = searchParams.get("language")
    
    if (videoId) {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
      setYoutubeUrl(youtubeUrl)
      handleUrlChange(youtubeUrl) // Process the URL immediately
    }
    
    // Set language from URL parameter if present
    if (language && language !== selectedLanguage) {
      setSelectedLanguage(language as SupportedLanguage)
    }
  }, [searchParams])

  // Handle URL input changes
  const handleUrlChange = async (url: string) => {
    setError(null)
    // Clear previous summary state instead of calling resetSummary
    setSummaryExists(false)
    setSummaryState({
      hasMySummary: false,
      hasOtherSummary: false
    })
    
    const videoId = extractYoutubeVideoId(url)
    if (videoId) {
      try {
        setVideoLoading(true)
        
        // Get video info
        const info = await fetchVideoDetailsServer(videoId)
        setVideoInfo(info.items[0])
        
        // Check detailed summary state
        const summaryInfo = await checkDetailedSummaryState(videoId, user?.id)
        setSummaryState(summaryInfo)
        setSummaryExists(summaryInfo.hasMySummary)
        
        // Update URL parameters only if they're different
        const currentVideoId = searchParams.get('videoId')
        const currentLanguage = searchParams.get('language')
        if (currentVideoId !== videoId || currentLanguage !== selectedLanguage) {
          const newUrl = new URL(window.location.href)
          newUrl.searchParams.set('videoId', videoId)
          newUrl.searchParams.set('language', selectedLanguage)
          router.replace(newUrl.pathname + newUrl.search, { scroll: false })
        }
        
      } catch (err) {
        setVideoInfo(null)
        setSummaryExists(false)
        setError("비디오 정보를 가져올 수 없습니다.")
      } finally {
        setVideoLoading(false)
      }
    } else {
      setVideoInfo(null)
      setSummaryExists(false)
      setSummaryState({
        hasMySummary: false,
        hasOtherSummary: false
      })
      // Clear URL parameters if no valid video ID
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('videoId')
      newUrl.searchParams.delete('language')
      router.replace(newUrl.pathname + newUrl.search, { scroll: false })
    }
  }

  // Detailed function to check summary state (인증 완료 후 실행)
  const checkDetailedSummaryState = async (videoId: string, userId?: string): Promise<{
    hasMySummary: boolean;
    hasOtherSummary: boolean;
    otherSummaryInfo?: { isGuest: boolean; created_at: string; };
  }> => {
    try {
      console.log(`[checkDetailedSummaryState] Checking for videoId: ${videoId}, userId: ${userId}, authLoading: ${authLoading}`)
      
      // 인증이 아직 로딩 중이면 기본값 반환 (데이터 요청 방지)
      if (authLoading) {
        console.log(`[checkDetailedSummaryState] 인증 로딩 중 - 기본값 반환`)
        return { hasMySummary: false, hasOtherSummary: false }
      }
      
      let hasMySummary = false;
      let hasOtherSummary = false;
      let otherSummaryInfo: { isGuest: boolean; created_at: string; } | undefined;
      
      // Check if video summary exists
      const { data: videoSummary, error: summaryError } = await supabase
        .from('video_summaries')
        .select('id, user_id, created_at')
        .eq('video_id', videoId)
        .maybeSingle()
      
      console.log(`[checkDetailedSummaryState] Video summary result:`, { videoSummary, summaryError })
      
      if (videoSummary) {
        // Check if user has this summary in their list
        if (userId) {
          const { data: userSummaryConnection, error: userError } = await supabase
            .from('user_summaries')
            .select('id')
            .eq('user_id', userId)
            .eq('summary_id', videoSummary.id)
            .maybeSingle()
          
          console.log(`[checkDetailedSummaryState] User summary connection result:`, { userSummaryConnection, userError })
          if (userSummaryConnection) {
            console.log(`[checkDetailedSummaryState] Found user summary connection`)
            hasMySummary = true
          }
        }
        
        // If user doesn't have this summary, mark as other summary
        if (!hasMySummary) {
          hasOtherSummary = true
          otherSummaryInfo = {
            isGuest: videoSummary.user_id === null,
            created_at: videoSummary.created_at
          }
          console.log(`[checkDetailedSummaryState] Found other summary:`, otherSummaryInfo)
        }
      }
      
      const result = { hasMySummary, hasOtherSummary, otherSummaryInfo }
      console.log(`[checkDetailedSummaryState] Final result:`, result)
      return result
    } catch (error) {
      console.error("Error checking detailed summary state:", error)
      return { hasMySummary: false, hasOtherSummary: false }
    }
  }


  // Initialize user permissions and models (중복 호출 방지)
  useEffect(() => {
    // 인증이 아직 로딩 중이면 대기
    if (authLoading) {
      console.log('[SimpleYoutubeForm] 인증 로딩 중 - 대기')
      return
    }
    
    const currentState = { user, authLoading }
    const prevState = prevUserState.current
    
    // 상태가 실제로 변경되었는지 확인
    const hasChanged = 
      prevState.authLoading !== currentState.authLoading ||
      prevState.user?.id !== currentState.user?.id ||
      prevState.user?.email !== currentState.user?.email
    
    console.log('[SimpleYoutubeForm] useEffect 트리거:', {
      current: { authLoading, userId: user?.id, email: user?.email },
      previous: { authLoading: prevState.authLoading, userId: prevState.user?.id, email: prevState.user?.email },
      hasChanged
    })
    
    if (!hasChanged) {
      console.log('[SimpleYoutubeForm] 상태 변경 없음 - 스킵')
      return
    }
    
    prevUserState.current = currentState
    
    const initializeUserSettings = async () => {
      console.log('[SimpleYoutubeForm] 인증 완료 후 사용자 설정 초기화 시작')
      
      if (user) {
        try {
          const models = getAvailableModels(user) as AIModel[]
          const defaultModel = getDefaultModel(user) as AIModel
          const adminStatus = isUserAdmin(user)
          
          setAvailableModels(models)
          setSelectedModel(defaultModel)
          setIsSpecialUser(adminStatus || user.email === 'yjs@lnrgame.com')
          console.log('[SimpleYoutubeForm] 로그인 사용자 초기화 완료:', { 
            email: user.email, 
            userMetadataRole: user.user_metadata?.role,
            appMetadataRole: user.app_metadata?.role,
            adminStatus, 
            models: models.length,
            hasUserMetadata: !!user.user_metadata,
            hasAppMetadata: !!user.app_metadata
          })
        } catch (error) {
          console.error('[SimpleYoutubeForm] 사용자 설정 초기화 오류:', error)
        }
      } else {
        // Guest user settings
        setAvailableModels(['gemini-2.5-flash'])
        setSelectedModel('gemini-2.5-flash')
        setIsSpecialUser(false)
        console.log('[SimpleYoutubeForm] 게스트 사용자 초기화 완료')
      }
    }

    initializeUserSettings()
  }, [user, authLoading])

  // Register reset callback
  useEffect(() => {
    const resetHandler = () => {
      setYoutubeUrl("")
      setVideoInfo(null)
      setSummaryExists(false)
      setSummaryState({
        hasMySummary: false,
        hasOtherSummary: false
      })
      setError(null)
      setIsLoading(false)
      setVideoLoading(false)
    }
    
    registerResetCallback(resetHandler)
  }, [registerResetCallback])

  // 새로운 영상 요약하기 버튼 클릭 이벤트 리스너
  useEffect(() => {
    const handleClearVideoInput = () => {
      console.log('[SimpleYoutubeForm] clearVideoInput 이벤트 수신 - input 초기화');
      setYoutubeUrl("");
      setVideoInfo(null);
      setSummaryExists(false);
      setSummaryState({
        hasMySummary: false,
        hasOtherSummary: false
      });
      setError(null);
      setIsLoading(false);
      setVideoLoading(false);
    };

    window.addEventListener('clearVideoInput', handleClearVideoInput);
    
    return () => {
      window.removeEventListener('clearVideoInput', handleClearVideoInput);
    };
  }, []);

  // Handle form submission for new summarization
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!youtubeUrl.trim()) {
      setError("YouTube URL을 입력해주세요.")
      return
    }

    const videoId = extractYoutubeVideoId(youtubeUrl)
    if (!videoId) {
      setError("유효한 YouTube URL을 입력해주세요.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await summarizeYoutubeVideo(
        youtubeUrl,
        selectedModel,
        undefined, // summaryPrompt
        user?.id,
        selectedPromptType,
        selectedLanguage, // language
        user?.email, // userEmail
        isSpecialUser // isUserAdminFromClient
      )

      if (result.success && result.videoId) {
        setSummaryExists(true)
        setSummaryState(prev => ({
          ...prev,
          hasMySummary: true
        }))
        // Update URL parameters to trigger summary container refresh
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.set('videoId', result.videoId)
        newUrl.searchParams.set('language', selectedLanguage)
        router.replace(newUrl.pathname + newUrl.search, { scroll: false })
        
        // Dispatch events and refresh with slight delays to ensure proper sequencing
        setTimeout(() => {
          console.log('[SimpleYoutubeForm] Dispatching summaryUpdated event for:', result.videoId)
          window.dispatchEvent(new CustomEvent('summaryUpdated', { detail: { videoId: result.videoId } }))
        }, 200)
        
        setTimeout(() => {
          console.log('[SimpleYoutubeForm] Refreshing sidebar summaries')
          refreshSummaries()
        }, 300)
      } else {
        setError(result.error || "요약 생성에 실패했습니다.")
      }
    } catch (err) {
      console.error("Summarization error:", err)
      setError("요약 생성 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle adding summary to my list
  const handleAddToMySummaries = async () => {
    if (!videoInfo?.id || !user?.id) {
      setError("로그인이 필요합니다.")
      return
    }

    console.log('[handleAddToMySummaries] 요약 추가 시작:', { videoId: videoInfo.id, userId: user.id })
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/add-to-my-summaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: videoInfo.id,
          userId: user.id
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[handleAddToMySummaries] API 응답:', result)

      if (result.success) {
        console.log('[handleAddToMySummaries] 요약 추가 성공, 상태 업데이트')
        
        // Update local state immediately
        setSummaryState(prev => ({
          ...prev,
          hasMySummary: true,
          hasOtherSummary: false // 이제 내 요약이 되었으므로 다른 요약이 아님
        }))
        setSummaryExists(true)
        
        // Update URL to ensure proper state
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.set('videoId', videoInfo.id)
        newUrl.searchParams.set('language', selectedLanguage)
        router.replace(newUrl.pathname + newUrl.search, { scroll: false })
        
        // Notify other components with proper sequencing
        console.log('[handleAddToMySummaries] 이벤트 발송 및 데이터 새로고침')
        
        // Dispatch summary updated event
        window.dispatchEvent(new CustomEvent('summaryUpdated', { 
          detail: { videoId: videoInfo.id, action: 'added' } 
        }))
        
        // Refresh sidebar summaries
        setTimeout(() => {
          refreshSummaries()
        }, 100)
        
      } else {
        console.error('[handleAddToMySummaries] API 오류:', result.error)
        setError(result.error || "요약 추가에 실패했습니다.")
      }
    } catch (err) {
      console.error("[handleAddToMySummaries] 요약 추가 중 오류:", err)
      setError("요약 추가 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
      console.log('[handleAddToMySummaries] 요약 추가 프로세스 완료')
    }
  }

  // Handle re-summarization
  const handleResummarize = async () => {
    console.log("[handleResummarize] 재요약 버튼 클릭됨")
    console.log("[handleResummarize] videoInfo:", videoInfo)
    console.log("[handleResummarize] user:", user)
    
    if (!videoInfo?.id) {
      console.error("[handleResummarize] 비디오 정보 없음")
      setError("비디오 정보가 없습니다.")
      return
    }

    // Debug: Check if summary exists in DB before re-summarizing
    try {
      console.log("[handleResummarize] DB에서 기존 요약 확인 중...")
      const { data: userSummary } = await supabase
        .from('video_summaries')
        .select('*')
        .eq('video_id', videoInfo.id)
        .eq('user_id', user?.id)
        .maybeSingle()
      
      console.log("[handleResummarize] 사용자 요약:", userSummary)
      console.log("[handleResummarize] dialog 필드:", {
        hasDialog: !!userSummary?.dialog,
        dialogType: typeof userSummary?.dialog,
        dialogLength: userSummary?.dialog ? (typeof userSummary.dialog === 'string' ? userSummary.dialog.length : JSON.stringify(userSummary.dialog).length) : 0,
        dialogPreview: userSummary?.dialog ? (typeof userSummary.dialog === 'string' ? userSummary.dialog.substring(0, 100) : JSON.stringify(userSummary.dialog).substring(0, 100)) : 'null'
      })
      
      // Debug: dialog 파싱 테스트
      if (userSummary?.dialog) {
        try {
          const dialogData = typeof userSummary.dialog === 'string' 
            ? JSON.parse(userSummary.dialog) 
            : userSummary.dialog;
          console.log("[handleResummarize] dialog 파싱 성공:", {
            isArray: Array.isArray(dialogData),
            length: Array.isArray(dialogData) ? dialogData.length : 'Not array',
            hasTextProperty: Array.isArray(dialogData) && dialogData.length > 0 && 'text' in dialogData[0],
            firstItem: Array.isArray(dialogData) && dialogData.length > 0 ? dialogData[0] : 'No items'
          })
        } catch (parseError) {
          console.error("[handleResummarize] dialog 파싱 실패:", parseError)
        }
      }
      
      if (!userSummary) {
        const { data: guestSummary } = await supabase
          .from('video_summaries')
          .select('*')
          .eq('video_id', videoInfo.id)
          .is('user_id', null)
          .maybeSingle()
        console.log("[handleResummarize] 게스트 요약:", guestSummary)
      }
    } catch (dbError) {
      console.error("[handleResummarize] DB 확인 오류:", dbError)
    }

    setIsLoading(true)
    setError(null)
    console.log("[handleResummarize] resummarizeYoutubeVideo 호출 시작", {
      videoId: videoInfo.id,
      userId: user?.id,
      selectedModel,
      selectedPromptType
    })

    try {
      const result = await resummarizeYoutubeVideo(
        videoInfo.id,
        selectedModel,
        user?.id,
        selectedPromptType,
        selectedLanguage, // language
        user?.email, // userEmail
        isSpecialUser // isUserAdminFromClient
      )
      
      console.log("[handleResummarize] resummarizeYoutubeVideo 결과:", result)

      if (result.success && result.videoId) {
        console.log("[handleResummarize] 재요약 성공, URL 파라미터 업데이트")
        // Update URL parameters to trigger summary container refresh
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.set('videoId', result.videoId)
        newUrl.searchParams.set('language', selectedLanguage)
        router.replace(newUrl.pathname + newUrl.search, { scroll: false })
        
        // Dispatch events and refresh with slight delays to ensure proper sequencing
        setTimeout(() => {
          console.log('[handleResummarize] Dispatching summaryUpdated event for:', result.videoId)
          window.dispatchEvent(new CustomEvent('summaryUpdated', { detail: { videoId: result.videoId } }))
        }, 200)
        
        setTimeout(() => {
          console.log('[handleResummarize] Refreshing sidebar summaries')
          refreshSummaries()
        }, 300)
      } else {
        console.error("[handleResummarize] 재요약 실패:", result.error)
        setError(result.error || "재요약에 실패했습니다.")
      }
    } catch (err) {
      console.error("Re-summarization error:", err)
      setError("재요약 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <LoadingContext.Provider value={isLoading}>
      <VideoPlayerProvider value={{ seekTo: () => {} }}>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="youtube-url">YouTube URL</Label>
                <Input
                  id="youtube-url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value)
                    handleUrlChange(e.target.value)
                  }}
                  className="w-full"
                  disabled={isLoading}
                />
              </div>

              {/* Language Selection */}
              <LanguageSelector
                value={selectedLanguage}
                onChange={setSelectedLanguage}
                disabled={isLoading}
              />

              {/* Model Selection */}
              {availableModels.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="model-select">AI Model</Label>
                  <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value as AIModel)}
                    className="w-full p-2 border rounded-md"
                    disabled={isLoading}
                  >
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {/* Show Summarize button only if no existing summary or user already has their own */}
                {(!summaryState.hasOtherSummary || summaryState.hasMySummary) && (
                  <Button 
                    type="submit" 
                    className="shrink-0" 
                    disabled={isLoading || summaryExists || videoLoading}
                    style={{minWidth: 120}}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        처리중...
                      </>
                    ) : (
                      "Summarize"
                    )}
                  </Button>
                )}

                {/* Show "Add to My Summaries" button if other summary exists but user doesn't have their own */}
                {summaryState.hasOtherSummary && !summaryState.hasMySummary && user && (
                  <Button
                    type="button"
                    className="shrink-0"
                    variant="default"
                    disabled={isLoading || videoLoading}
                    onClick={handleAddToMySummaries}
                    style={{minWidth: 120}}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        추가 중...
                      </>
                    ) : (
                      "내 요약에 추가"
                    )}
                  </Button>
                )}
                
                {summaryExists && isSpecialUser && (
                  <Button
                    type="button"
                    className="shrink-0"
                    variant="outline"
                    disabled={isLoading || videoLoading}
                    onClick={handleResummarize}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        재요약 중...
                      </>
                    ) : (
                      "Re-Summarize"
                    )}
                  </Button>
                )}
                
                {/* Debug: Show button conditions */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <div>Debug: hasMySummary={summaryState.hasMySummary.toString()}, hasOtherSummary={summaryState.hasOtherSummary.toString()}</div>
                    <div>isSpecialUser={isSpecialUser.toString()}, User: {user?.email || 'Guest'}</div>
                    <div>Other summary: {summaryState.otherSummaryInfo?.isGuest ? 'Guest' : 'User'} ({summaryState.otherSummaryInfo?.created_at})</div>
                    <div>Available models: {availableModels.join(', ')}</div>
                  </div>
                )}
              </div>

              {/* Video Info Display */}
              {videoLoading && (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">비디오 정보를 불러오는 중...</span>
                </div>
              )}

              {videoInfo && !videoLoading && (
                <div className="border rounded-md p-3 bg-muted/50">
                  <h3 className="font-medium">{videoInfo.snippet.title}</h3>
                  <p className="text-sm text-muted-foreground">{videoInfo.snippet.channelTitle}</p>
                  {summaryState.hasMySummary && (
                    <p className="text-sm text-green-600 mt-1">✓ 내 요약이 이미 존재합니다</p>
                  )}
                  {summaryState.hasOtherSummary && !summaryState.hasMySummary && (
                    <p className="text-sm text-blue-600 mt-1">
                      ℹ️ {summaryState.otherSummaryInfo?.isGuest ? '게스트' : '다른 사용자'}의 요약이 존재합니다
                      {summaryState.otherSummaryInfo?.created_at && (
                        ` (${new Date(summaryState.otherSummaryInfo.created_at).toLocaleDateString('ko-KR')})`
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Error Display */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>오류</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
        </Card>
      
      </VideoPlayerProvider>
    </LoadingContext.Provider>
  )
}