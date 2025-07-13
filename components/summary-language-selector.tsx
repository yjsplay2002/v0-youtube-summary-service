"use client"

import { useState, useEffect, useTransition } from "react"
import { useAuth } from "@/components/auth-context"
import { getTranscriptLanguages, summarizeVideoInLanguage } from "@/app/actions"
import { SUPPORTED_LANGUAGES } from "./language-selector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface SummaryLanguageSelectorProps {
  videoId: string
  summarizedLanguages: string[]
  currentLanguage: string
  onLanguageChange: (language: string) => void
  onSummaryCreated: (language: string, summary: string) => void
}

export function SummaryLanguageSelector({
  videoId,
  summarizedLanguages,
  currentLanguage,
  onLanguageChange,
  onSummaryCreated,
}: SummaryLanguageSelectorProps) {
  const { user } = useAuth()
  const [isPending, startTransition] = useTransition()
  const [isSummarizing, setIsSummarizing] = useState<string | null>(null)

  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])

  useEffect(() => {
    if (videoId && user?.id) {
      getTranscriptLanguages(videoId).then((langs) => {
        if (langs) {
          setAvailableLanguages(langs)
        }
      })
    }
  }, [videoId, user?.id, summarizedLanguages])

  const handleSummarize = (languageCode: string) => {
    setIsSummarizing(languageCode)
    startTransition(async () => {
      try {
        const languageName = getLanguageName(languageCode)
        toast.info(`${languageName} 언어로 요약을 시작합니다...`)
        const result = await summarizeVideoInLanguage(
          videoId,
          languageCode,
          user?.id,
          user?.email || undefined,
          false
        )
        if (result.success && result.summary) {
          toast.success(`${languageName} 언어 요약이 완료되었습니다.`)
          onSummaryCreated(languageCode, result.summary)
          onLanguageChange(languageCode)
          
          // Dispatch event to notify other components about the new summary
          setTimeout(() => {
            console.log(`[SummaryLanguageSelector] Dispatching summaryUpdated event for ${videoId} in ${languageCode}`)
            window.dispatchEvent(new CustomEvent('summaryUpdated', { 
              detail: { videoId, language: languageCode } 
            }))
          }, 100)
        } else {
          throw new Error(result.error || "Failed to create summary.")
        }
      } catch (error) {
        console.error(error)
        toast.error(`요약 생성 실패: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        setIsSummarizing(null)
      }
    })
  }

  const getLanguageName = (code: string) => {
    return SUPPORTED_LANGUAGES.find((lang) => lang.code === code)?.nativeName || code
  }

  // 기본 언어들 (자주 사용되는 언어들)
  const defaultLanguages = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de']
  
  const languagesToShow = user ? 
    (availableLanguages.length > 0 ? availableLanguages : defaultLanguages) : 
    summarizedLanguages
  
  const combinedLanguages = [...new Set([...summarizedLanguages, ...languagesToShow])].sort()


  return (
    <div className="flex items-center gap-2">
      <Select value={currentLanguage} onValueChange={onLanguageChange} disabled={isPending || !!isSummarizing}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="언어 선택" />
          {isSummarizing && (
            <div className="ml-2 flex items-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
            </div>
          )}
        </SelectTrigger>
        <SelectContent>
          {combinedLanguages.map((langCode) => {
            const isSummarized = summarizedLanguages.includes(langCode)
            return (
              <SelectItem
                key={langCode}
                value={langCode}
                disabled={isSummarizing === langCode}
              >
                <div 
                  className="flex justify-between w-full items-center cursor-pointer"
                  onClick={(e) => {
                    if (!isSummarized && user && !isSummarizing) {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSummarize(langCode)
                    } else if (isSummarized) {
                      onLanguageChange(langCode)
                    }
                  }}
                >
                  <span className={`${!isSummarized && user ? 'font-medium' : ''}`}>
                    {getLanguageName(langCode)}
                  </span>
                  <div className="flex items-center gap-1">
                    {isSummarized && (
                      <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        완료
                      </span>
                    )}
                    {!isSummarized && user && (
                      <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded font-semibold">
                        {isSummarizing === langCode ? "요약 중..." : "요약하기"}
                      </span>
                    )}
                  </div>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
