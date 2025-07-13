"use client"
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useContext } from "react";
import { SummaryDisplayClient } from "@/components/summary-display";
import { getSummaryWithMetadata, fetchVideoDetailsServer } from "@/app/actions";
import { LoadingContext } from "@/components/youtube-form";
import YouTube, { YouTubePlayer } from "react-youtube";
import { useResetContext } from "@/components/reset-context";
import { useAuth } from "@/components/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { generateVideoSummaryStructuredData, injectStructuredData } from "@/app/lib/structured-data";
import { SUPPORTED_LANGUAGES } from "@/components/language-selector";
import { supabase } from "@/app/lib/supabase";
import { SummaryLanguageSelector } from "./summary-language-selector";
import { useI18n } from "@/hooks/use-i18n";

export default function SummaryContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams.get("videoId");
  const urlLanguage = searchParams.get("language");
  
  const [summary, setSummary] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [summaryMetadata, setSummaryMetadata] = useState<{
    language?: string;
    created_at: string;
    user_id?: string;
    isGuest?: boolean;
    foundLanguage?: string;
    isFallback?: boolean;
    availableLanguages?: string[];
  } | null>(null);
  const [videoInfo, setVideoInfo] = useState<any | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [playerRef, setPlayerRef] = useState<YouTubePlayer | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const { user } = useAuth();
  
  // i18n hook
  const { t } = useI18n();
  
  const retryCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { registerResetCallback } = useResetContext();

  useEffect(() => {
    const loadInitialLanguage = async () => {
      if (urlLanguage) {
        setSelectedLanguage(urlLanguage);
        return;
      }
      if (user?.id) {
        try {
          const { data } = await supabase
            .from('user_preferences')
            .select('preferred_language')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (data?.preferred_language) {
            setSelectedLanguage(data.preferred_language);
          } else {
            const browserLang = navigator.language.split('-')[0];
            const supportedLang = SUPPORTED_LANGUAGES.find(lang => lang.code === browserLang);
            setSelectedLanguage(supportedLang?.code || 'en');
          }
        } catch (error) {
          console.error('Error loading user language preference:', error);
          setSelectedLanguage('en');
        }
      } else {
        const browserLang = navigator.language.split('-')[0];
        const supportedLang = SUPPORTED_LANGUAGES.find(lang => lang.code === browserLang);
        setSelectedLanguage(supportedLang?.code || 'en');
      }
    };

    loadInitialLanguage();
  }, [user?.id, urlLanguage]);
  
  const fetchVideoDetails = useCallback(async (id: string) => {
    try {
      console.log(`[SummaryDisplay] Fetching video details for: ${id}`);
      const videoDetails = await fetchVideoDetailsServer(id);
      const videoInfo = videoDetails.items[0];
      setVideoInfo(videoInfo);
      
      if (videoInfo) {
        const structuredData = generateVideoSummaryStructuredData(videoInfo);
        injectStructuredData(structuredData);
      }
    } catch (error) {
      console.error("[SummaryDisplay] Failed to fetch video details:", error);
    }
  }, []);
  
  useEffect(() => {
    if (videoId) {
      fetchVideoDetails(videoId);
    }
  }, [videoId, fetchVideoDetails]);

  const fetchSummary = useCallback(async (lang: string) => {
    if (!videoId) return;

    if (summaries[lang]) {
      setSummary(summaries[lang]);
      return;
    }

    setIsRetrying(true);
    try {
      const result = await getSummaryWithMetadata(videoId, user?.id, lang);
      if (result) {
        setSummary(result.summary);
        setSummaries(prev => ({ ...prev, [result.foundLanguage || lang]: result.summary }));
        setSummaryMetadata(result);
      } else {
        setSummary(""); // No summary for this language
      }
    } catch (error) {
      console.error(`[SummaryDisplay] Error fetching summary for ${lang}:`, error);
      setSummary("");
    } finally {
      setIsRetrying(false);
    }
  }, [videoId, user?.id]);

  useEffect(() => {
    if (videoId) {
      fetchSummary(selectedLanguage);
    } else {
      setSummary(null);
      setSummaryMetadata(null);
      setVideoInfo(null);
      setSummaries({});
    }
  }, [videoId, selectedLanguage, fetchSummary]);

  const handleLanguageChange = (newLanguage: string) => {
    setSelectedLanguage(newLanguage);
    const params = new URLSearchParams(window.location.search);
    params.set('language', newLanguage);
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  const handleSummaryCreated = (language: string, newSummary: string) => {
    setSummaries(prev => ({ ...prev, [language]: newSummary }));
    setSummaryMetadata(prev => ({
      ...prev!,
      availableLanguages: [...new Set([...(prev?.availableLanguages || []), language])]
    }));
    setSummary(newSummary);
    setSelectedLanguage(language);
  };

  const handleSeek = (seconds: number) => {
    if (playerRef) {
      playerRef.seekTo(seconds, true);
      playerRef.playVideo();
    }
  };

  const loading = useContext(LoadingContext);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="aspect-video w-full rounded-md" />
      </div>
    );
  }
  
  if (!videoId) return null;
  
  if (summary === null || isRetrying) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">
              {isRetrying ? t('container.fetching') : t('container.preparing')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {videoInfo && (
        <div className="w-full border rounded p-3 bg-muted/40">
          <div className="font-semibold mb-1">{videoInfo.snippet.title}</div>
          <div className="mb-2 text-xs text-muted-foreground">{videoInfo.snippet.channelTitle}</div>
          <div className="w-full aspect-video rounded overflow-hidden">
            <YouTube
              videoId={videoInfo.id}
              className="w-full h-full rounded"
              iframeClassName="w-full h-full rounded"
              opts={{
                width: '100%',
                height: '100%',
                playerVars: { rel: 0, modestbranding: 1, enablejsapi: 1, origin: typeof window !== 'undefined' ? window.location.origin : undefined },
              }}
              onReady={(e: { target: YouTubePlayer }) => setPlayerRef(e.target)}
              onError={(error) => console.debug('YouTube player error ignored:', error)}
            />
          </div>
        </div>
      )}
      
      <SummaryLanguageSelector
        videoId={videoId}
        summarizedLanguages={summaryMetadata?.availableLanguages || []}
        currentLanguage={selectedLanguage}
        onLanguageChange={handleLanguageChange}
        onSummaryCreated={handleSummaryCreated}
      />
      
      {summary.trim() === "" ? (
        <div className="text-center text-muted-foreground py-8">
          {t('container.noSummary')}
        </div>
      ) : (
        <SummaryDisplayClient summary={summary} seekTo={handleSeek} videoId={videoId} />
      )}
    </div>
  );
}

