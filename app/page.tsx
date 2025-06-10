import { YoutubeForm } from "@/components/youtube-form"
import SummaryDisplay from "@/components/summary-display"
import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { PricingSection } from "@/components/pricing-section"
import { FAQSection } from "@/components/faq-section"
import { Suspense } from "react"

interface HomeProps {
  searchParams: Promise<{ videoId?: string }>
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const currentVideoId = resolvedSearchParams.videoId;

  // Show full landing page if no video is being processed
  if (!currentVideoId) {
    return (
      <div className="min-h-screen">
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <FAQSection />
        
        {/* Main app section */}
        <section id="youtube-form" className="py-20">
          <div className="container mx-auto py-10 px-4 max-w-5xl">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Start Summarizing</h2>
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
        </section>
      </div>
    );
  }

  // Show focused interface when processing a video
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
