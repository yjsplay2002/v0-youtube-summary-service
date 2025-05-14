"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, AlertCircle } from "lucide-react"
import { summarizeYoutubeVideo } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter } from "next/navigation"

export function YoutubeForm() {
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showApiKeyError, setShowApiKeyError] = useState(false)
  const router = useRouter()

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
      const errorMessage = err.message || "Failed to process the video"

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
            <Input
              type="text"
              placeholder="Enter YouTube URL (e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ)"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="w-full"
              disabled={isLoading}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Summarize Video"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
