'use client';

import { useAuth } from "@/components/auth-context"
import { SimpleYoutubeForm } from "@/components/simple-youtube-form"
import SimpleSummaryContainer from "@/components/simple-summary-container"
import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { PricingSection } from "@/components/pricing-section"
import { FAQSection } from "@/components/faq-section"
import CurationSection from "@/components/curation-section"
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

            <SimpleYoutubeForm />
            
            {/* 큐레이션 섹션 추가 */}
            <div className="mt-16">
              <Suspense fallback={<div className="text-center">Loading recommendations...</div>}>
                <CurationSection />
              </Suspense>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Default interface for both logged in users and when processing videos
  return (
    <div className="container mx-auto py-10 px-4 max-w-5xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">YouTube Video Summarizer</h1>
        <p className="text-muted-foreground">
          Enter a YouTube link to get a summarized markdown version of the video content
        </p>
      </div>

      <SimpleYoutubeForm />
      <div className="mt-10">
        <Suspense fallback={<div className="text-center">Loading summary...</div>}>
          <SimpleSummaryContainer />
        </Suspense>
      </div>
      
      {/* 큐레이션 섹션 추가 */}
      <div className="mt-16">
        <Suspense fallback={<div className="text-center">Loading recommendations...</div>}>
          <CurationSection />
        </Suspense>
      </div>
    </div>
  );
}