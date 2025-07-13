"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/components/auth-context"
import { supabase } from "@/app/lib/supabase"
import { useI18n } from "@/hooks/use-i18n"

export type SupportedLanguage = 'en' | 'ko' | 'ja' | 'zh' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru'

export interface LanguageOption {
  code: SupportedLanguage
  name: string
  nativeName: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' }
]

interface LanguageSelectorProps {
  value: SupportedLanguage
  onChange: (language: SupportedLanguage) => void
  disabled?: boolean
}

export function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)

  // Function to detect browser language
  const detectBrowserLanguage = (): SupportedLanguage => {
    const browserLang = navigator.language.split('-')[0] as SupportedLanguage
    return SUPPORTED_LANGUAGES.find(lang => lang.code === browserLang)?.code || 'en'
  }

  // Load user's preferred language from database
  useEffect(() => {
    const loadUserPreferredLanguage = async () => {
      if (!user) {
        // For guest users, use browser language
        const browserLang = detectBrowserLanguage()
        onChange(browserLang)
        return
      }

      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('preferred_language')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) {
          console.error('Error loading user language preference:', error)
          // Fall back to browser language
          onChange(detectBrowserLanguage())
          return
        }

        if (data?.preferred_language) {
          onChange(data.preferred_language as SupportedLanguage)
        } else {
          // First time user - set browser language as default
          const browserLang = detectBrowserLanguage()
          onChange(browserLang)
          await saveUserPreferredLanguage(browserLang)
        }
      } catch (err) {
        console.error('Error loading user language preference:', err)
        onChange(detectBrowserLanguage())
      }
    }

    loadUserPreferredLanguage()
  }, [user, onChange])

  // Save user's preferred language to database
  const saveUserPreferredLanguage = async (language: SupportedLanguage) => {
    if (!user) return

    try {
      setIsLoading(true)
      
      // Check if user preference already exists
      const { data: existingPreference } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingPreference) {
        // Update existing preference
        const { error } = await supabase
          .from('user_preferences')
          .update({ preferred_language: language })
          .eq('user_id', user.id)

        if (error) {
          console.error('Error updating user language preference:', error)
        }
      } else {
        // Insert new preference
        const { error } = await supabase
          .from('user_preferences')
          .insert({
            user_id: user.id,
            preferred_language: language
          })

        if (error) {
          console.error('Error inserting user language preference:', error)
        }
      }
    } catch (err) {
      console.error('Error saving user language preference:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLanguageChange = (language: SupportedLanguage) => {
    onChange(language)
    if (user) {
      saveUserPreferredLanguage(language)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="language-select">{t('language.summaryLanguageLabel')}</Label>
      <Select
        value={value}
        onValueChange={handleLanguageChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger id="language-select">
          <SelectValue placeholder={t('language.selectPlaceholder2')} />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.nativeName} ({lang.name})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}