import { YoutubeForm } from "@/components/youtube-form"
import { SummaryDisplay } from "@/components/summary-display"

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold text-center mb-8">YouTube Video Summarizer</h1>
      <p className="text-center mb-8 text-muted-foreground">
        Enter a YouTube link to get a summarized markdown version of the video content
      </p>
      <YoutubeForm />
      <div className="mt-10">
        <SummaryDisplay />
      </div>
    </main>
  )
}
