'use client';

import { useAuth } from "@/components/auth-context"
import { YoutubeForm } from "@/components/youtube-form"
import SummaryDisplay from "@/components/summary-display"
import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { PricingSection } from "@/components/pricing-section"
import { FAQSection } from "@/components/faq-section"
import { Suspense } from "react"

interface HomeClientProps {
  currentVideoId?: string;
}

export default function HomeClient({ currentVideoId }: HomeClientProps) {
  const { user, loading } = useAuth();

  // Show loading state while auth is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  // If user is not logged in and no video is being processed, show landing page
  if (!user && !currentVideoId) {
    return (
      <div className="min-h-screen">
        {/*
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <FAQSection />
        */}        
        {/* Main app section */}
        <section id="youtube-form" className="py-20">
          <div className="container mx-auto py-10 px-4 max-w-5xl">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">AI-Powered Video Summarization</h2>
              <p className="text-muted-foreground">
              Save hours of watching time. Get comprehensive, structured summaries of any YouTube video 
              in seconds using advanced AI technology.
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

  // If user is logged in or processing a video, show focused interface
  if (currentVideoId) {
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
    );
  }

  // Logged in user with no video - show clean interface
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
  );
}