"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle } from "lucide-react"
import { summarizeYoutubeVideo, fetchVideoDetailsServer, resummarizeYoutubeVideo, getAvailablePromptTypes } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter, useSearchParams } from "next/navigation"
import type { AIModel, PromptType } from "@/app/lib/summary"
import { extractYoutubeVideoId } from "./youtube-form-utils"
import YouTube, { YouTubePlayer, YouTubeEvent } from "react-youtube"
import { VideoPlayerProvider } from "@/components/VideoPlayerContext"
import { createContext } from "react"
import { useSummaryContext } from "@/components/summary-context"
import { useResetContext } from "@/components/reset-context"
import { useAuth } from "@/components/auth-context"
import { getAvailableModels, getDefaultModel, isUserAdmin, getUserSubscriptionTier, getSubscriptionLimits } from "@/app/lib/auth-utils"
import { supabase } from "@/app/lib/supabase"

export const LoadingContext = createContext(false)

export function SimpleYoutubeForm() {
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<any | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [summaryExists, setSummaryExists] = useState(false)
  const [selectedModel, setSelectedModel] = useState<AIModel>('claude-3-5-haiku')
  const [selectedPromptType, setSelectedPromptType] = useState<PromptType>('general_summary')
  const [availablePromptTypes, setAvailablePromptTypes] = useState<PromptType[]>([])
  const [isSpecialUser, setIsSpecialUser] = useState(false)
  const [availableModels, setAvailableModels] = useState<AIModel[]>([])
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { resetSummary } = useSummaryContext()
  const { registerResetCallback } = useResetContext()

  // Initialize form with URL parameter if present
  useEffect(() => {
    const videoId = searchParams.get("videoId")
    if (videoId) {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
      setYoutubeUrl(youtubeUrl)
      handleUrlChange(youtubeUrl) // Process the URL immediately
    }
  }, [searchParams])

  // Handle URL input changes
  const handleUrlChange = async (url: string) => {
    setError(null)
    resetSummary()
    
    const videoId = extractYoutubeVideoId(url)
    if (videoId) {
      try {
        setVideoLoading(true)
        
        // Get video info
        const info = await fetchVideoDetailsServer(videoId)
        setVideoInfo(info.items[0])
        
        // Check if summary exists (simple DB check, no getSummary call)
        const hasUserSummary = await checkSummaryExists(videoId, user?.id)
        setSummaryExists(hasUserSummary)
        
        // Update URL parameter
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.set('videoId', videoId)
        router.replace(newUrl.pathname + newUrl.search, { scroll: false })
        
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
      // Clear URL parameter if no valid video ID
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('videoId')
      router.replace(newUrl.pathname + newUrl.search, { scroll: false })
    }
  }

  // Simple function to check if summary exists
  const checkSummaryExists = async (videoId: string, userId?: string): Promise<boolean> => {
    try {
      // Check user's personal summaries
      if (userId) {
        const { data: userSummary } = await supabase
          .from('video_summaries')
          .select('id')
          .eq('video_id', videoId)
          .eq('user_id', userId)
          .maybeSingle()
        
        if (userSummary) return true
      }
      
      // Check legacy summaries
      const { data: legacySummary } = await supabase
        .from('youtube_summaries')
        .select('id')
        .eq('video_id', videoId)
        .maybeSingle()
      
      return Boolean(legacySummary)
    } catch (error) {
      console.error("Error checking summary existence:", error)
      return false
    }
  }

  // Initialize user permissions and models
  useEffect(() => {
    const initializeUserSettings = async () => {
      if (user) {
        try {
          const models = await getAvailableModels(user.id)
          const defaultModel = await getDefaultModel(user.id)
          const promptTypes = await getAvailablePromptTypes(user.id)
          const adminStatus = await isUserAdmin(user.id)
          
          setAvailableModels(models)
          setSelectedModel(defaultModel)
          setAvailablePromptTypes(promptTypes)
          setIsSpecialUser(adminStatus || user.email === 'yjs@lnrgame.com')
        } catch (error) {
          console.error('Error initializing user settings:', error)
        }
      } else {
        // Guest user settings
        setAvailableModels(['claude-3-5-haiku'])
        setSelectedModel('claude-3-5-haiku')
        setAvailablePromptTypes(['general_summary'])
        setIsSpecialUser(false)
      }
    }

    initializeUserSettings()
  }, [user])

  // Register reset callback
  useEffect(() => {
    const resetHandler = () => {
      setYoutubeUrl("")
      setVideoInfo(null)
      setSummaryExists(false)
      setError(null)
      setIsLoading(false)
      setVideoLoading(false)
    }
    
    registerResetCallback(resetHandler)
  }, [registerResetCallback])

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
        user?.id,
        selectedModel,
        selectedPromptType
      )

      if (result.success) {
        setSummaryExists(true)
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

  // Handle re-summarization
  const handleResummarize = async () => {
    if (!videoInfo?.id) {
      setError("비디오 정보가 없습니다.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await resummarizeYoutubeVideo(
        videoInfo.id,
        user?.id,
        selectedModel,
        selectedPromptType
      )

      if (result.success) {
        // Refresh the page to show new summary
        window.location.reload()
      } else {
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
      <VideoPlayerProvider>
        <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
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

                {/* Prompt Type Selection */}
                {availablePromptTypes.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="prompt-select">요약 스타일</Label>
                    <select
                      id="prompt-select"
                      value={selectedPromptType}
                      onChange={(e) => setSelectedPromptType(e.target.value as PromptType)}
                      className="w-full p-2 border rounded-md"
                      disabled={isLoading}
                    >
                      {availablePromptTypes.map((promptType) => (
                        <option key={promptType} value={promptType}>
                          {promptType === 'general_summary' ? '일반 요약' : '토론형 요약'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
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
                    {summaryExists && (
                      <p className="text-sm text-green-600 mt-1">✓ 요약이 이미 존재합니다</p>
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
        </div>
      </VideoPlayerProvider>
    </LoadingContext.Provider>
  )
}