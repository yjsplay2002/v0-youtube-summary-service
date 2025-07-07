'use client';

import { useAuth } from "@/components/auth-context"
import { memo } from "react"
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

const HomeClient = memo(function HomeClient({ currentVideoId }: HomeClientProps) {
  const { user, loading } = useAuth();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[HomeClient] Props 수신:', { currentVideoId, user: !!user, loading });
  }

  // Show loading state while auth is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is not logged in and no video is being processed, show landing page
  if (!user && !currentVideoId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-accent/10">
        {/*
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <FAQSection />
        */}        
        {/* Main app section */}
        <section id="youtube-form" className="py-20">
          <div className="container mx-auto py-10 px-4 max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 gradient-text">
                AI-Powered Video Summarization
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Save hours of watching time. Get comprehensive, structured summaries of any YouTube video 
                in seconds using advanced AI technology.
              </p>
            </div>

            <div className="glass-effect rounded-2xl shadow-2xl shadow-glow-accent mb-16">
              <SimpleYoutubeForm />
            </div>
            
            {/* 큐레이션 섹션 임시 숨김 처리 */}
            {false && (
              <div className="mt-16">
                <Suspense fallback={<div className="text-center">Loading recommendations...</div>}>
                  <CurationSection />
                </Suspense>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  // Default interface for both logged in users and when processing videos
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-accent/10">
      <div className="container mx-auto py-10 px-4 max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 gradient-text">
            YouTube Video Summarizer
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Enter a YouTube link to get a summarized markdown version of the video content
          </p>
        </div>

        <div className="glass-effect rounded-2xl shadow-2xl shadow-glow-accent mb-10">
          <SimpleYoutubeForm />
        </div>
        
        <div className="mt-10">
          <Suspense fallback={
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading summary...</p>
            </div>
          }>
            <SimpleSummaryContainer />
          </Suspense>
        </div>
        
        {/* 큐레이션 섹션 추가 */}
        <div className="mt-16">
          <Suspense fallback={
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading recommendations...</p>
            </div>
          }>
            <CurationSection currentVideoId={currentVideoId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
});

export default HomeClient;