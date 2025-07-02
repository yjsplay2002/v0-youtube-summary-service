import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
// import { PricingSection } from "@/components/pricing-section" - Temporarily commented out
import { FAQSection } from "@/components/faq-section"
import { Suspense } from "react"
import { YoutubeForm } from "@/components/youtube-form"
import SummaryContainer from "@/components/summary-container"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "YouTube Video Summarizer - AI-Powered Video Summary Tool",
  description: "Transform YouTube videos into concise, structured markdown summaries using AI. Save time by getting key insights from any video in seconds.",
  keywords: "YouTube summarizer, video summary, AI video analysis, markdown conversion, video transcript, content analysis",
  robots: "index, follow",
  openGraph: {
    title: "YouTube Video Summarizer - AI-Powered Video Summary Tool",
    description: "Transform YouTube videos into concise, structured markdown summaries using AI. Save time by getting key insights from any video in seconds.",
    type: "website",
    siteName: "YouTube Video Summarizer",
  },
  alternates: {
    canonical: "/randing"
  }
}

export default function RandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
      {/* <PricingSection /> - Temporarily hidden as subscription feature is not ready */}
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
              <SummaryContainer />
            </Suspense>
          </div>
        </div>
      </section>
    </div>
  )
}