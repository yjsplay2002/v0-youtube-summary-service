"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, AlertCircle } from "lucide-react"
import { summarizeYoutubeVideo, fetchVideoDetailsServer } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter } from "next/navigation"

import { useEffect, useRef } from "react"
import { extractYoutubeVideoId } from "./youtube-form-utils"
import YouTube, { YouTubePlayer, YouTubeEvent } from "react-youtube"
import { VideoPlayerProvider } from "@/components/VideoPlayerContext"

export function YoutubeForm() {
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showApiKeyError, setShowApiKeyError] = useState(false)
  const [videoInfo, setVideoInfo] = useState<any | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoFetchTimeout = useRef<NodeJS.Timeout | null>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const router = useRouter()

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

    try {
      setIsLoading(true)
      setError("")
      setShowApiKeyError(false)

      // Call the server action to process the YouTube URL
      const result = await summarizeYoutubeVideo(youtubeUrl)

      if (result.success && result.videoId) {
        // Handle successful processing by navigating to the results page
        router.push(`/?videoId=${result.videoId}`)
      } else {
        // Handle error from server action
        if (result.error?.includes("OPENAI_API_KEY is missing")) {
          setShowApiKeyError(true)
        } else {
          setError(result.error || "Failed to process the video")
        }
      }
    } catch (err) {
      console.error(err)
      const errorMessage = err instanceof Error ? err.message : "Failed to process the video"

      if (errorMessage.includes("OPENAI_API_KEY is missing")) {
        setShowApiKeyError(true)
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <VideoPlayerProvider value={{ seekTo }}>
      <Card>
        <CardContent className="pt-6">
        {showApiKeyError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>API Key Missing</AlertTitle>
            <AlertDescription>
              OpenAI API key is missing. Please add it to your environment variables.
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://platform.openai.com/api-keys", "_blank")}
                >
                  Get OpenAI API Key
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
             <div className="flex gap-2 items-center">
              <Input
                type="text"
                placeholder="Enter YouTube URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)"
                value={youtubeUrl}
                onChange={async (e) => {
                  const value = e.target.value;
                  setYoutubeUrl(value);
                  setVideoInfo(null);
                  setError("");
                  // debounce
                  if (videoFetchTimeout.current) clearTimeout(videoFetchTimeout.current);
                  videoFetchTimeout.current = setTimeout(async () => {
                    const videoId = extractYoutubeVideoId(value);
                    if (videoId) {
                      try {
                        setVideoLoading(true);
                        const info = await fetchVideoDetailsServer(videoId);
                        setVideoInfo(info.items[0]);
                      } catch (err) {
                        setVideoInfo(null);
                      } finally {
                        setVideoLoading(false);
                      }
                    } else {
                      setVideoInfo(null);
                    }
                  }, 500);
                }}
                className="w-full"
                disabled={isLoading}
              />
              <Button type="submit" className="shrink-0" disabled={isLoading} style={{minWidth:120}}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Summarize Video"
                )}
              </Button>
            </div>
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
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
  )
}
