"use client"

import { useState, useEffect, useTransition } from "react"
import { useAuth } from "@/components/auth-context"
import { getTranscriptLanguages, summarizeVideoInLanguage } from "@/app/actions"
import { SUPPORTED_LANGUAGES, LanguageOption } from "./language-selector"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "./ui/button"
import { toast } from "sonner"

interface SummaryLanguageSelectorProps {
  videoId: string
  summarizedLanguages: string[]
  allLanguages: string[]
  currentLanguage: string
  onLanguageChange: (language: string) => void
  onSummaryCreated: (language: string, summary: string) => void
}

export function SummaryLanguageSelector({
  videoId,
  summarizedLanguages,
  allLanguages,
  currentLanguage,
  onLanguageChange,
  onSummaryCreated,
}: SummaryLanguageSelectorProps) {
  const { user, isAdmin } = useAuth()
  const [isPending, startTransition] = useTransition()
  const [isSummarizing, setIsSummarizing] = useState<string | null>(null)

  useEffect(() => {
    if (videoId && user?.id) {
      getTranscriptLanguages(videoId).then((langs) => {
        if (langs) {
          setAllLanguages(langs)
        }
      })
    }
  }, [videoId, user?.id, summarizedLanguages])

  const handleSummarize = (languageCode: string) => {
    setIsSummarizing(languageCode)
    startTransition(async () => {
      try {
        toast.info(`${languageCode} 언어로 요약을 시작합니다...`)
        const result = await summarizeVideoInLanguage(
          videoId,
          languageCode,
          user?.id,
          user?.email || undefined,
          isAdmin
        )
        if (result.success && result.summary) {
          toast.success(`${languageCode} 언어 요약이 완료되었습니다.`)
          onSummaryCreated(languageCode, result.summary)
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

  const languagesToShow = user ? allLanguages : summarizedLanguages
  const combinedLanguages = [...new Set([...summarizedLanguages, ...languagesToShow])].sort()

  return (
    <div className="flex items-center gap-2">
      <Select value={currentLanguage} onValueChange={onLanguageChange} disabled={isPending || !!isSummarizing}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="언어 선택" />
        </SelectTrigger>
        <SelectContent>
          {combinedLanguages.map((langCode) => {
            const isSummarized = summarizedLanguages.includes(langCode)
            return (
              <SelectItem
                key={langCode}
                value={langCode}
                disabled={isSummarizing === langCode}
                onSelect={(e) => {
                  if (!isSummarized && user && !isSummarizing) {
                    e.preventDefault()
                    handleSummarize(langCode)
                  }
                }}
              >
                <div className="flex justify-between w-full items-center">
                  <span>{getLanguageName(langCode)}</span>
                  {!isSummarized && user && (
                    <span className="text-xs text-blue-500 ml-2 font-semibold">
                      {isSummarizing === langCode ? "요약 중..." : "요약하기"}
                    </span>
                  )}
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
