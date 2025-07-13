'use client';

import { useAuth } from "@/components/auth-context"
import { memo, useEffect, useState, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { summarizeYoutubeVideo } from "@/app/actions"
import { getDefaultModel, isUserAdmin } from "@/app/lib/auth-utils"
import type { AIModel, PromptType } from "@/app/lib/summary"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/components/language-selector"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Globe } from "lucide-react"
import { SimpleYoutubeForm } from "@/components/simple-youtube-form"
import SimpleSummaryContainer from "@/components/simple-summary-container"
import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"
import { PricingSection } from "@/components/pricing-section"
import { FAQSection } from "@/components/faq-section"
import CurationSection from "@/components/curation-section"
import { Suspense } from "react"
import { useVideoLanguages } from "@/hooks/use-video-languages"

interface HomeClientProps {
  currentVideoId?: string;
}

const HomeClient = memo(function HomeClient({ currentVideoId: initialVideoId }: HomeClientProps) {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Memoize expensive searchParams computation
  const searchParamsObject = useMemo(() => {
    return Object.fromEntries(searchParams.entries())
  }, [searchParams]);

  // Memoize currentVideoId computation
  const currentVideoId = useMemo(() => {
    return searchParams.get('videoId') || initialVideoId;
  }, [searchParams, initialVideoId]);
  
  // States for multi-language summarization
  const [isLanguageDialogOpen, setIsLanguageDialogOpen] = useState(false);
  const [selectedLanguageForSummary, setSelectedLanguageForSummary] = useState<string>('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini-2.5-flash');
  const [isSpecialUser, setIsSpecialUser] = useState(false);
  
  // Use shared video languages hook to prevent duplicate API calls
  const { languages: availableLanguages, refreshLanguages } = useVideoLanguages(currentVideoId || null);
  
  // Move debug logging to useEffect to prevent render-time computation
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const renderTimestamp = performance.now();
      console.log('[HomeClient] State 변경:', { 
        timestamp: renderTimestamp.toFixed(2) + 'ms',
        initialVideoId, 
        currentVideoId, 
        user: !!user, 
        loading,
        searchParams: searchParamsObject
      });
    }
  }, [initialVideoId, currentVideoId, user, loading, searchParamsObject]);

  // Initialize user settings
  useEffect(() => {
    if (user) {
      try {
        const defaultModel = getDefaultModel(user) as AIModel
        const adminStatus = isUserAdmin(user)
        
        setSelectedModel(defaultModel)
        setIsSpecialUser(adminStatus || user.email === 'yjs@lnrgame.com')
      } catch (error) {
        console.error('[HomeClient] 사용자 설정 초기화 오류:', error)
      }
    } else {
      setSelectedModel('gemini-2.5-flash')
      setIsSpecialUser(false)
    }
  }, [user])

  // Languages are now handled by the useVideoLanguages hook automatically

  // Memoize language display name function
  const getLanguageDisplayName = useCallback((langCode: string) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode)
    return lang ? `${lang.nativeName} (${lang.name})` : langCode
  }, []);

  // Memoize available languages for new summary (exclude already summarized ones)
  const getUnsummarizedLanguages = useCallback(() => {
    const summarizedLanguages = availableLanguages.map(lang => lang.language)
    return SUPPORTED_LANGUAGES.filter(lang => !summarizedLanguages.includes(lang.code))
  }, [availableLanguages]);

  // Memoize language selection handler
  const handleLanguageSelection = useCallback(async () => {
    if (!selectedLanguageForSummary || !currentVideoId) return

    console.log(`[HomeClient] 다른 언어로 요약 시작: ${selectedLanguageForSummary}`)
    setIsSummarizing(true)

    try {
      const youtubeUrl = `https://www.youtube.com/watch?v=${currentVideoId}`
      
      const result = await summarizeYoutubeVideo(
        youtubeUrl,
        selectedModel,
        undefined, // summaryPrompt
        user?.id,
        'general_summary' as PromptType,
        selectedLanguageForSummary as SupportedLanguage,
        user?.email,
        isSpecialUser
      )

      if (result.success && result.videoId) {
        console.log(`[HomeClient] 다른 언어 요약 성공: ${selectedLanguageForSummary}`)
        
        // Close dialog and reset selection
        setIsLanguageDialogOpen(false)
        setSelectedLanguageForSummary('')
        
        // Refresh available languages using the shared hook
        refreshLanguages(currentVideoId)
        
        // Navigate to the new summary
        router.push(`/?videoId=${currentVideoId}&language=${selectedLanguageForSummary}`)
        
        // Dispatch events for other components to refresh
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('summaryUpdated', { 
            detail: { videoId: currentVideoId, language: selectedLanguageForSummary } 
          }))
        }, 200)
        
      } else {
        console.error(`[HomeClient] 다른 언어 요약 실패:`, result.error)
      }
    } catch (error) {
      console.error('Error summarizing in different language:', error)
    } finally {
      setIsSummarizing(false)
    }
  }, [selectedLanguageForSummary, currentVideoId, selectedModel, user?.id, user?.email, isSpecialUser, refreshLanguages, router]);

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

  // Check if we're on a video summary page (has videoId) or main page (no videoId)
  const isVideoSummaryPage = !!currentVideoId;

  // Video Summary Page - Only show video player and summary component
  if (isVideoSummaryPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/10 to-accent/10">
        <div className="container mx-auto py-10 px-4 max-w-5xl">
          <div className="flex justify-between items-center mb-8">
            <div className="text-left">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 gradient-text">
                Video Summary
              </h1>
              <p className="text-sm text-muted-foreground">
                AI-generated summary and analysis
              </p>
            </div>
            <button
              onClick={() => {
                console.log('[HomeClient] 새로운 영상 요약하기 버튼 클릭 (타이틀 영역)');
                // 메인 페이지의 input field 초기화를 위한 이벤트 발생
                window.dispatchEvent(new CustomEvent('clearVideoInput'));
                // Next.js router를 사용해서 메인 페이지로 이동 (페이지 새로고침 없음)
                router.push('/');
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              새로운 영상 요약하기
            </button>
          </div>

          <div className="mt-6">
            <Suspense fallback={
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading summary...</p>
              </div>
            }>
              <SimpleSummaryContainer />
            </Suspense>
          </div>
        </div>
      </div>
    );
  }

  // Main Page - Show form component for new video summarization
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
        
        {/* 큐레이션 섹션 임시 비활성화 */}
        {false && (
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
        )}
      </div>
    </div>
  );
});

export default HomeClient;