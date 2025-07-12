"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, Check, Share2, Loader2 } from "lucide-react"
import { SummaryChat } from "@/components/summary-chat"
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/components/language-selector"
import { summarizeYoutubeVideo } from "@/app/actions"
import { useAuth } from "@/components/auth-context"
import { getAvailableModels, getDefaultModel, isUserAdmin } from "@/app/lib/auth-utils"
import type { AIModel, PromptType } from "@/app/lib/summary"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { toast } from 'sonner'

interface LanguageOption {
  language: string;
  created_at: string;
  summary_id: string;
}

interface SummaryDisplayProps {
  summary: string;
  seekTo: (seconds: number) => void;
  videoId?: string;
  currentLanguage?: string;
  onLanguageChange?: (language: string, summary: string) => void;
  onNewSummaryCreated?: () => void; // Callback to refresh available languages
}

export function SummaryDisplayClient({ 
  summary, 
  seekTo, 
  videoId, 
  currentLanguage = 'en',
  onLanguageChange,
  onNewSummaryCreated
}: SummaryDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([])
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summarizingLanguage, setSummarizingLanguage] = useState<string | null>(null)
  
  // Auth and user settings
  const { user } = useAuth()
  const [selectedModel, setSelectedModel] = useState<AIModel>('gemini-2.5-flash')
  const [isSpecialUser, setIsSpecialUser] = useState(false)

  // Initialize user settings
  useEffect(() => {
    if (user) {
      try {
        const models = getAvailableModels(user) as AIModel[]
        const defaultModel = getDefaultModel(user) as AIModel
        const adminStatus = isUserAdmin(user)
        
        setSelectedModel(defaultModel)
        setIsSpecialUser(adminStatus || user.email === 'yjs@lnrgame.com')
      } catch (error) {
        console.error('[SummaryDisplayClient] 사용자 설정 초기화 오류:', error)
      }
    } else {
      setSelectedModel('gemini-2.5-flash')
      setIsSpecialUser(false)
    }
  }, [user])

  // Fetch available languages for this video
  useEffect(() => {
    const fetchAvailableLanguages = async () => {
      if (!videoId) return

      setIsLoadingLanguages(true)
      try {
        const response = await fetch(`/api/video-languages?videoId=${encodeURIComponent(videoId)}`)
        if (response.ok) {
          const data = await response.json()
          setAvailableLanguages(data.languages || [])
        }
      } catch (error) {
        console.error('Error fetching available languages:', error)
        setAvailableLanguages([])
      } finally {
        setIsLoadingLanguages(false)
      }
    }

    fetchAvailableLanguages()
  }, [videoId])

  // Handle language selection change
  const handleLanguageChange = async (selectedLanguage: string) => {
    if (!videoId || selectedLanguage === currentLanguage) return

    console.log(`[SummaryDisplayClient] 언어 변경: ${currentLanguage} -> ${selectedLanguage}`)
    
    // Check if this language already has a summary
    const existingLanguage = availableLanguages.find(lang => lang.language === selectedLanguage)
    
    if (existingLanguage) {
      // Language has summary, fetch it
      console.log(`[SummaryDisplayClient] 기존 요약 불러오기: ${selectedLanguage}`)
      
      // Update URL parameters immediately for responsive UI
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.set('videoId', videoId)
      newUrl.searchParams.set('language', selectedLanguage)
      window.history.replaceState({}, '', newUrl.pathname + newUrl.search)

      setIsLoadingSummary(true)
      try {
        const response = await fetch(`/api/video-summary-by-language?videoId=${encodeURIComponent(videoId)}&language=${encodeURIComponent(selectedLanguage)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.summary && onLanguageChange) {
            onLanguageChange(selectedLanguage, data.summary)
          }
        } else {
          if (onLanguageChange) {
            onLanguageChange(selectedLanguage, '')
          }
        }
      } catch (error) {
        console.error('Error fetching summary for language:', error)
        if (onLanguageChange) {
          onLanguageChange(selectedLanguage, '')
        }
      } finally {
        setIsLoadingSummary(false)
      }
    } else {
      // Language doesn't have summary, create it automatically
      console.log(`[SummaryDisplayClient] 새로운 요약 생성: ${selectedLanguage}`)
      
      if (user) {
        await handleSummarizeInSpecificLanguage(selectedLanguage)
      } else {
        // For non-logged in users, just switch to show no summary state
        if (onLanguageChange) {
          onLanguageChange(selectedLanguage, '')
        }
      }
    }
  }

  // Handle summarization in specific language
  const handleSummarizeInSpecificLanguage = async (targetLanguage: string) => {
    if (!videoId || !targetLanguage) return

    console.log(`[SummaryDisplayClient] 특정 언어 요약 시작: ${targetLanguage}`)
    setSummarizingLanguage(targetLanguage)
    setIsSummarizing(true)

    const languageName = getLanguageDisplayName(targetLanguage)
    toast.info(`${languageName} 언어로 요약을 시작합니다...`)

    // Update URL to target language immediately
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('videoId', videoId)
    newUrl.searchParams.set('language', targetLanguage)
    window.history.replaceState({}, '', newUrl.pathname + newUrl.search)

    try {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
      
      const result = await summarizeYoutubeVideo(
        youtubeUrl,
        selectedModel,
        undefined,
        user?.id,
        'general_summary' as PromptType,
        targetLanguage as SupportedLanguage,
        user?.email,
        isSpecialUser
      )

      if (result.success && result.videoId) {
        console.log(`[SummaryDisplayClient] 언어별 요약 성공: ${targetLanguage}`)
        toast.success(`${languageName} 언어 요약이 완료되었습니다!`)
        
        // Fetch the new summary
        const response = await fetch(`/api/video-summary-by-language?videoId=${encodeURIComponent(videoId)}&language=${encodeURIComponent(targetLanguage)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.summary && onLanguageChange) {
            onLanguageChange(targetLanguage, data.summary)
          }
        }
        
        // Refresh available languages
        if (onNewSummaryCreated) {
          onNewSummaryCreated()
        }
        
        const languageResponse = await fetch(`/api/video-languages?videoId=${encodeURIComponent(videoId)}`)
        if (languageResponse.ok) {
          const languageData = await languageResponse.json()
          setAvailableLanguages(languageData.languages || [])
        }
        
      } else {
        console.error(`[SummaryDisplayClient] 언어별 요약 실패:`, result.error)
        toast.error(`${languageName} 요약 생성에 실패했습니다: ${result.error}`)
      }
    } catch (error) {
      console.error('Error summarizing in specific language:', error)
      toast.error(`${languageName} 요약 생성 중 오류가 발생했습니다.`)
    } finally {
      setIsSummarizing(false)
      setSummarizingLanguage(null)
    }
  }

  // Handle summarization in current language (for button in no-summary state)
  const handleSummarizeInLanguage = async () => {
    if (!currentLanguage) return
    await handleSummarizeInSpecificLanguage(currentLanguage)
  }

  // Get language display name
  const getLanguageDisplayName = (langCode: string) => {
    const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode)
    return lang ? lang.nativeName : langCode
  }

  // Get expanded language list including popular languages
  const getExpandedLanguageList = () => {
    const popularLanguages = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de']
    const existingLanguageSet = new Set(availableLanguages.map(lang => lang.language))
    
    const expandedList: (LanguageOption & { hasSummary: boolean })[] = []
    
    // Add existing languages first
    availableLanguages.forEach(lang => {
      expandedList.push({ ...lang, hasSummary: true })
    })
    
    // Add popular languages that don't have summaries yet
    if (user) {
      popularLanguages.forEach(langCode => {
        if (!existingLanguageSet.has(langCode)) {
          expandedList.push({
            language: langCode,
            created_at: '',
            summary_id: '',
            hasSummary: false
          })
        }
      })
    }
    
    return expandedList.sort((a, b) => {
      // Sort by: has summary first, then alphabetically
      if (a.hasSummary && !b.hasSummary) return -1
      if (!a.hasSummary && b.hasSummary) return 1
      return getLanguageDisplayName(a.language).localeCompare(getLanguageDisplayName(b.language))
    })
  }

  // Handle timestamp button clicks
  const handleTimestampClick = (seconds: number) => {
    console.log(`[SummaryDisplayClient] 타임스탬프 클릭: ${seconds}초로 이동`);
    seekTo(seconds);
    
    // 사용자에게 시각적 피드백 제공
    const button = document.activeElement as HTMLElement;
    if (button && button.classList.contains('timestamp-btn')) {
      const originalBg = button.style.backgroundColor;
      button.style.backgroundColor = '#22c55e'; // green-500
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.backgroundColor = originalBg;
        button.style.transform = 'scale(1)';
      }, 200);
    }
  };

  // Process timestamps function that uses the seekTo prop
  const processTimestampsWithSeekTo = (children: any): any => {
    if (typeof children === 'string') {
      // Enhanced regex to match various timestamp formats including hours
      const timestampRegex = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = timestampRegex.exec(children)) !== null) {
        // Add text before timestamp
        if (match.index > lastIndex) {
          parts.push(children.slice(lastIndex, match.index));
        }

        // Calculate seconds from timestamp
        const hours = match[3] ? parseInt(match[1]) : 0;
        const minutes = match[3] ? parseInt(match[2]) : parseInt(match[1]);
        const seconds = match[3] ? parseInt(match[3]) : parseInt(match[2]);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;

        // Add clickable timestamp
        parts.push(
          <span
            key={`timestamp-${match.index}`}
            className="text-sky-500 hover:text-sky-600 underline cursor-pointer timestamp-btn transition-colors font-medium"
            onClick={(e) => {
              e.preventDefault();
              handleTimestampClick(totalSeconds);
            }}
          >
            {match[0]}
          </span>
        );

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < children.length) {
        parts.push(children.slice(lastIndex));
      }

      return parts.length > 1 ? parts : children;
    }

    // If children is an array, process each child
    if (Array.isArray(children)) {
      return children.map((child, index) => 
        typeof child === 'string' ? processTimestampsWithSeekTo(child) : child
      );
    }

    return children;
  };


  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShare = async () => {
    if (!videoId) return

    const shareUrl = `${window.location.origin}/?videoId=${videoId}`
    const shareText = `YouTube 요약: ${summary.split('\n')[0] || '비디오 요약'}`

    try {
      // Web Share API 지원 확인
      if (navigator.share) {
        await navigator.share({
          title: 'YouTube 비디오 요약',
          text: shareText,
          url: shareUrl
        })
        console.log('[SummaryDisplayClient] Web Share API로 공유 완료')
      } else {
        // 폴백: URL을 클립보드에 복사
        await navigator.clipboard.writeText(shareUrl)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
        console.log('[SummaryDisplayClient] URL 클립보드에 복사 완료')
      }
    } catch (error) {
      console.error('[SummaryDisplayClient] 공유 실패:', error)
      
      // 에러 발생 시 폴백: URL을 클립보드에 복사
      try {
        await navigator.clipboard.writeText(shareUrl)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
        console.log('[SummaryDisplayClient] 폴백으로 URL 클립보드에 복사 완료')
      } catch (clipboardError) {
        console.error('[SummaryDisplayClient] 클립보드 복사도 실패:', clipboardError)
      }
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Video Summary</CardTitle>
        <div className="flex items-center gap-2">
          {/* Enhanced Language Selector - show available and creatable languages */}
          <Select
            value={currentLanguage}
            onValueChange={handleLanguageChange}
            disabled={isLoadingLanguages || isLoadingSummary || summarizingLanguage !== null}
          >
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue>
                {isLoadingSummary || summarizingLanguage !== null ? (
                  <div className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">
                      {summarizingLanguage ? `${getLanguageDisplayName(summarizingLanguage)} 요약중...` : '로딩중...'}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs">{getLanguageDisplayName(currentLanguage)}</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {getExpandedLanguageList().map((langOption) => (
                <SelectItem key={langOption.language} value={langOption.language}>
                  <div className="flex justify-between w-full items-center">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{getLanguageDisplayName(langOption.language)}</span>
                      {langOption.hasSummary ? (
                        <span className="text-xs text-muted-foreground">
                          {new Date(langOption.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      ) : (
                        <span className="text-xs text-blue-500">
                          요약 생성 가능
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {langOption.hasSummary ? (
                        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          완료
                        </span>
                      ) : user && (
                        <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                          {summarizingLanguage === langOption.language ? "요약 중..." : "생성"}
                        </span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={handleCopy} className="flex items-center gap-1">
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleShare} 
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!videoId}
          >
            {shared ? (
              <>
                <Check className="h-4 w-4" />
                Shared
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Share it
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Show "no summary" state with summarize button */}
        {(!summary || summary.trim() === '') ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              선택한 언어({getLanguageDisplayName(currentLanguage)})에 대한 요약이 없습니다.
            </div>
            <Button
              onClick={handleSummarizeInLanguage}
              disabled={isSummarizing || !videoId}
              className="px-6 py-2"
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {currentLanguage}로 요약 중...
                </>
              ) : (
                `${getLanguageDisplayName(currentLanguage)}로 요약하기`
              )}
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="preview">
            <TabsList className="mb-4">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="chat">Ask to AI</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:mb-4 prose-li:mb-1 prose-ul:my-4 prose-ol:my-4 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-md prose-pre:overflow-auto prose-a:text-blue-600 hover:prose-a:text-blue-800 prose-strong:font-bold prose-em:italic">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                // Custom text renderer to convert timestamps to clickable links
                p: ({ children, ...props }) => {
                  const processedChildren = processTimestampsWithSeekTo(children);
                  return <p {...props}>{processedChildren}</p>;
                },
                li: ({ children, ...props }) => {
                  const processedChildren = processTimestampsWithSeekTo(children);
                  return <li {...props}>{processedChildren}</li>;
                },
                // Custom link renderer for timestamps
                a: ({ href, children, ...props }) => {
                  // Check if this is a timestamp link (supports multiple formats)
                  const timestampMatch = href?.match(/[&?]t=(\d+)s?$/);
                  
                  // Also check for time format in the children text (e.g., "1:23:45", "12:34", "0:05")
                  const childrenText = children?.toString() || '';
                  const timeFormatMatch = childrenText.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
                  
                  let seconds = 0;
                  
                  if (timestampMatch) {
                    // URL parameter format: t=123
                    seconds = parseInt(timestampMatch[1]);
                  } else if (timeFormatMatch) {
                    // Time format: H:MM:SS or MM:SS
                    const hours = timeFormatMatch[3] ? parseInt(timeFormatMatch[1]) : 0;
                    const minutes = timeFormatMatch[3] ? parseInt(timeFormatMatch[2]) : parseInt(timeFormatMatch[1]);
                    const secs = timeFormatMatch[3] ? parseInt(timeFormatMatch[3]) : parseInt(timeFormatMatch[2]);
                    
                    seconds = hours * 3600 + minutes * 60 + secs;
                  }
                  
                  // If we found a valid timestamp, make it clickable
                  if (seconds > 0) {
                    return (
                      <span
                        className="text-sky-500 hover:text-sky-600 underline cursor-pointer timestamp-btn transition-colors font-medium"
                        onClick={(e) => {
                          e.preventDefault();
                          handleTimestampClick(seconds);
                        }}
                        {...props}
                      >
                        {children}
                      </span>
                    );
                  }
                  // Regular external link - let prose handle styling
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                      {children}
                    </a>
                  );
                }
              }}
            >
              {summary?.replace(/^(#{1,6})\s+(.+?)\s+\1\s*$/gm, '$1 $2')}
            </ReactMarkdown>
          </TabsContent>
            <TabsContent value="chat">
              {videoId && (
                <SummaryChat summary={summary} videoId={videoId} />
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

