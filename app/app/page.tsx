import { YoutubeForm } from "@/components/youtube-form"
import SummaryDisplay from "@/components/summary-display"
import { Suspense } from "react"

interface AppProps {
  searchParams: Promise<{ videoId?: string }>
}

export default async function App({ searchParams }: AppProps) {
  const resolvedSearchParams = await searchParams;
  const currentVideoId = resolvedSearchParams.videoId;

  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">YouTube Video Summarizer</h1>
        <p className="text-muted-foreground">
          Enter a YouTube link to get a summarized markdown version of the video content
        </p>
      </div>

      <YoutubeForm />
      <div className="mt-10">
        <Suspense fallback={<div className="text-center">Loading summary...</div>}>
          <SummaryDisplay />
        </Suspense>
      </div>
    </div>
  )
}