"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle } from "lucide-react"
import { summarizeYoutubeVideo, fetchVideoDetailsServer, resummarizeYoutubeVideo, getAvailablePromptTypes } from "@/app/actions"
import { getSummary } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import type { AIModel, PromptType } from "@/app/lib/summary"

import { useEffect, useRef } from "react"
import { extractYoutubeVideoId } from "./youtube-form-utils"
import YouTube, { YouTubePlayer, YouTubeEvent } from "react-youtube"
import { VideoPlayerProvider } from "@/components/VideoPlayerContext"

import { createContext } from "react";
import { useSummaryContext } from "@/components/summary-context";
import { useResetContext } from "@/components/reset-context";
import { useAuth } from "@/components/auth-context";
import { getAvailableModels, getDefaultModel, isUserAdmin, getUserSubscriptionTier, getSubscriptionLimits } from "@/app/lib/auth-utils";

export const LoadingContext = createContext(false);

export function YoutubeForm() {
  // 추가 state
  const [summaryExists, setSummaryExists] = useState(false);
  const [loadingStage, setLoadingStage] = useState<"none"|"transcript"|"summary">("none");
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [selectedModel, setSelectedModel] = useState<AIModel>("claude-3-5-haiku")
  const [selectedPromptType, setSelectedPromptType] = useState<PromptType>("general_summary")
  const [availablePromptTypes, setAvailablePromptTypes] = useState<Array<{type: string, title: string, description: string}>>([])
  const [availableModels, setAvailableModels] = useState<Array<{value: string, label: string}>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showApiKeyError, setShowApiKeyError] = useState(false)
  const [videoInfo, setVideoInfo] = useState<any | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoFetchTimeout = useRef<NodeJS.Timeout | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const router = useRouter()
  const { refreshSummaries } = useSummaryContext();
  const { resetSummary } = useResetContext();
  const { user } = useAuth();
  const isSpecialUser = user?.email === "yjs@lnrgame.com";
  const userIsAdmin = isUserAdmin(user);
  const userTier = getUserSubscriptionTier(user);
  const userLimits = getSubscriptionLimits(userTier);

  // 사용자별 권한에 따른 모델 및 프롬프트 타입 로드
  useEffect(() => {
    const loadOptions = async () => {
      // 사용자 권한에 따른 사용 가능한 모델 설정
      const models = getAvailableModels(user);
      setAvailableModels(models);
      
      // 사용자가 현재 선택한 모델이 사용 불가능하면 기본 모델로 변경
      const defaultModel = getDefaultModel(user);
      if (!models.some(m => m.value === selectedModel)) {
        setSelectedModel(defaultModel as AIModel);
      }

      // 구독 계층에 따른 프롬프트 타입 설정
      const availablePromptTypes = userLimits.promptTypes;
      
      if (availablePromptTypes.includes('detailed_analysis')) {
        try {
          const promptTypes = await getAvailablePromptTypes();
          setAvailablePromptTypes(promptTypes);
        } catch (error) {
          console.error('Failed to load prompt types:', error);
          // 기본값 설정
          setAvailablePromptTypes([
            { type: 'general_summary', title: '일반 요약', description: '구조화된 형식으로 요약' },
            { type: 'discussion_format', title: '토론식 요약', description: '두 화자의 토론 형식으로 요약' },
            { type: 'detailed_analysis', title: '상세 분석', description: '깊이 있는 분석과 인사이트 제공' }
          ]);
        }
      } else if (availablePromptTypes.includes('discussion_format')) {
        setAvailablePromptTypes([
          { type: 'general_summary', title: '일반 요약', description: '구조화된 형식으로 요약' },
          { type: 'discussion_format', title: '토론식 요약', description: '두 화자의 토론 형식으로 요약' }
        ]);
      } else {
        // Free tier
        setAvailablePromptTypes([
          { type: 'general_summary', title: '일반 요약', description: '구조화된 형식으로 요약' }
        ]);
        setSelectedPromptType('general_summary');
      }
    };
    loadOptions();
  }, [user, selectedModel, userTier]);

  // 큐레이션 섹션에서 비디오 클릭 시 URL 자동 입력을 위한 이벤트 리스너
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'FILL_YOUTUBE_URL' && event.data.url) {
        setYoutubeUrl(event.data.url);
        // URL이 설정되면 자동으로 비디오 정보 로드
        const videoId = extractYoutubeVideoId(event.data.url);
        if (videoId) {
          setVideoInfo(null);
          setError("");
          resetSummary();
          setVideoLoading(true);
          
          fetchVideoDetailsServer(videoId)
            .then(info => {
              setVideoInfo(info.items[0]);
              setVideoLoading(false);
              
              // 요약 존재 여부 확인
              getSummary(videoId, user?.id)
                .then(summary => {
                  setSummaryExists(!!summary);
                })
                .catch(() => setSummaryExists(false));
            })
            .catch(err => {
              setVideoLoading(false);
              setError("비디오 정보를 불러올 수 없습니다.");
            });
        }
      }
    };

    window.addEventListener('message', handleMessage, { passive: true });
    return () => window.removeEventListener('message', handleMessage);
  }, [user?.id, resetSummary]);

  // 영상 시킹 함수 (props/context로 전달 가능)
  const seekTo = (seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds, true);
      playerRef.current.playVideo();
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  if (!youtubeUrl) {
    setError("Please enter a YouTube URL")
    return
  }
  
  // Reset the current summary display
  resetSummary();

  try {
    setIsLoading(true)
    setLoadingStage("transcript");
    setError("")
    setShowApiKeyError(false)

    // Call the server action to process the YouTube URL
    const result = await summarizeYoutubeVideo(youtubeUrl, selectedModel, undefined, user?.id, selectedPromptType)

    setLoadingStage("summary");

    if (result.success && result.videoId) {
      setLoadingStage("none");
      // Handle successful processing by navigating to the results page
      router.push(`/?videoId=${result.videoId}`)
      refreshSummaries();
      
      // 요약 완료 후 폼 초기화
      setYoutubeUrl("");
      setVideoInfo(null);
      setSummaryExists(false);
      setError("");
    } else {
      setLoadingStage("none");
      // Handle error from server action
      if (result.error?.includes("OPENAI_API_KEY is missing") || result.error?.includes("ANTHROPIC_API_KEY is missing")) {
        setShowApiKeyError(true)
      } else {
        setError(result.error || "Failed to process the video")
      }
    }
  } catch (err) {
    setLoadingStage("none");
    console.error(err)
    const errorMessage = err instanceof Error ? err.message : "Failed to process the video"

    if (errorMessage.includes("OPENAI_API_KEY is missing") || errorMessage.includes("ANTHROPIC_API_KEY is missing")) {
      setShowApiKeyError(true)
    } else {
      setError(errorMessage)
    }
  } finally {
    setIsLoading(false)
    setLoadingStage("none");
  }
}


  return (
    <LoadingContext.Provider value={isLoading}>
    <VideoPlayerProvider value={{ seekTo }}>
      <Card>
        <CardContent className="pt-6">
        {showApiKeyError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>API Key Missing</AlertTitle>
            <AlertDescription>
              {selectedModel.startsWith('claude') ? (
                <>
                  Anthropic API key is missing. Please add ANTHROPIC_API_KEY to your environment variables.
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open("https://console.anthropic.com/", "_blank")}
                    >
                      Get Anthropic API Key
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  OpenAI API key is missing. Please add OPENAI_API_KEY to your environment variables.
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open("https://platform.openai.com/api-keys", "_blank")}
                    >
                      Get OpenAI API Key
                    </Button>
                  </div>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            {userIsAdmin && (
              <div className="space-y-2">
                <Label htmlFor="ai-model">AI 모델 선택</Label>
                <select
                  id="ai-model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as AIModel)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {availableModels.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {userIsAdmin && (
              <div className="space-y-2">
                <Label htmlFor="prompt-type">요약 형식 선택</Label>
                <select
                  id="prompt-type"
                  value={selectedPromptType}
                  onChange={(e) => setSelectedPromptType(e.target.value as PromptType)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {availablePromptTypes.map((promptType) => (
                    <option key={promptType.type} value={promptType.type}>
                      {promptType.title}
                    </option>
                  ))}
                </select>
                {availablePromptTypes.find(p => p.type === selectedPromptType)?.description && (
                  <p className="text-xs text-muted-foreground">
                    {availablePromptTypes.find(p => p.type === selectedPromptType)?.description}
                  </p>
                )}
              </div>
            )}
             <div className="flex gap-2 items-center">
              <Input
                type="text"
                placeholder="Enter YouTube URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)"
                value={youtubeUrl}
                onChange={(e) => {
  // Only update the URL input - other state updates will be handled in the debounced function
  const value = e.target.value;
  setYoutubeUrl(value);
  
  // debounce other state changes and API calls
  if (videoFetchTimeout.current) clearTimeout(videoFetchTimeout.current);
  videoFetchTimeout.current = setTimeout(async () => {
    // Reset states at the beginning of the debounced function
    setVideoInfo(null);
    setError("");
    resetSummary();
    
    const videoId = extractYoutubeVideoId(value);
    if (videoId) {
      try {
        setVideoLoading(true);
        const info = await fetchVideoDetailsServer(videoId);
        setVideoInfo(info.items[0]);
        setVideoLoading(false);
        
        // Check if summary exists, but don't update state immediately to prevent infinite loops
        try {
          const summary = await getSummary(videoId, user?.id);
          // Update summary existence state only after all other state updates are complete
          // Use a slight delay to avoid synchronization issues
          setTimeout(() => {
            setSummaryExists(Boolean(summary && summary.trim() !== ""));
          }, 100);
        } catch (summaryErr) {
          console.error("Error checking summary existence:", summaryErr);
          setTimeout(() => {
            setSummaryExists(false);
          }, 100);
        }
      } catch (err) {
        setVideoInfo(null);
        setVideoLoading(false);
        setTimeout(() => {
          setSummaryExists(false);
        }, 100);
      }
    } else {
      setVideoInfo(null);
      setTimeout(() => {
        setSummaryExists(false);
      }, 100);
    }
  }, 500);
}}
                className="w-full"
                disabled={isLoading}
              />
              <div className="flex flex-col gap-2">
                <Button type="submit" className="shrink-0" disabled={isLoading || summaryExists} style={{minWidth:120}}>
                  Summarize
                </Button>
                {summaryExists && isSpecialUser && (
                  <Button 
                    type="button" 
                    className="shrink-0" 
                    variant="outline" 
                    disabled={isLoading}
                    onClick={async (e) => {
                      e.preventDefault();
                      try {
                        const videoId = extractYoutubeVideoId(youtubeUrl);
                        if (!videoId) {
                          setError("Please enter a valid YouTube URL");
                          return;
                        }
                        
                        setError("");
                        setShowApiKeyError(false);
                        
                        // Check if user is logged in
                        if (!user) {
                          setError("로그인이 필요합니다.");
                          setLoadingStage("none");
                          return;
                        }
                        
                        setIsLoading(true);
                        setLoadingStage("summary");
                        
                        // Call the resummarizeYoutubeVideo server action
                        const result = await resummarizeYoutubeVideo(videoId, user.id, selectedModel, undefined, selectedPromptType);
                        
                        if (result.success && result.videoId) {
                          setLoadingStage("none");
                          // Handle successful processing by navigating to the results page
                          router.push(`/?videoId=${result.videoId}`);
                          refreshSummaries();
                        } else {
                          setLoadingStage("none");
                          // Handle error from server action
                          if (result.error?.includes("OPENAI_API_KEY is missing") || result.error?.includes("ANTHROPIC_API_KEY is missing")) {
                            setShowApiKeyError(true);
                          } else {
                            setError(result.error || "Failed to re-summarize the video");
                          }
                        }
                      } catch (err) {
                        setLoadingStage("none");
                        console.error(err);
                        const errorMessage = err instanceof Error ? err.message : "Failed to re-summarize the video";
                        
                        if (errorMessage.includes("OPENAI_API_KEY is missing") || errorMessage.includes("ANTHROPIC_API_KEY is missing")) {
                          setShowApiKeyError(true);
                        } else {
                          setError(errorMessage);
                        }
                      } finally {
                        setIsLoading(false);
                        setLoadingStage("none");
                      }
                    }}
                    style={{minWidth:120}}
                  >
                    Re-summarize
                  </Button>
                )}
              </div>
            </div>
            {/* Status text box */}
            {summaryExists && (
              <div className="text-sm text-amber-500 mt-2 p-2 border border-amber-200 rounded bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                <AlertCircle className="inline-block mr-2 h-4 w-4" />
                This video has already been summarized
              </div>
            )}
            {isLoading && (
              <div className="text-sm text-blue-500 mt-2 p-2 border border-blue-200 rounded bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" />
                {loadingStage === "transcript" ? "Fetching transcript..." : 
                 loadingStage === "summary" ? "Summarizing..." : "Processing..."}
              </div>
            )}
            {error && <p className="text-sm text-red-500 mt-1 p-2 border border-red-200 rounded bg-red-50 dark:bg-red-950 dark:border-red-800">{error}</p>}
            {/* 영상 미리보기 */}
            {videoLoading && <div className="text-sm text-blue-500 mt-2">영상을 불러오는 중...</div>}
            {videoInfo && (
              <div className="mt-4 w-full border rounded p-3 bg-muted/40">
                <div className="font-semibold mb-1">{videoInfo.snippet.title}</div>
                <div className="mb-2 text-xs text-muted-foreground">{videoInfo.snippet.channelTitle}</div>
                <div className="w-full aspect-video rounded overflow-hidden">
                  {/* react-youtube로 교체 */}
                  {videoInfo && (
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
                      onReady={(e: YouTubeEvent<any>) => {
                        playerRef.current = e.target;
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
    </VideoPlayerProvider>
    </LoadingContext.Provider>
  )
}
