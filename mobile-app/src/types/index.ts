export type AIModel = 'gemini-2.5-flash' | 'claude-3-haiku' | 'claude-3-sonnet' | 'gpt-4o-mini' | 'gpt-4o'

export type PromptType = 'general_summary' | 'educational_summary' | 'business_summary' | 'technical_summary'

export type SupportedLanguage = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr' | 'de' | 'pt' | 'ru' | 'it' | 'nl' | 'pl' | 'tr' | 'ar' | 'hi' | 'th' | 'vi'

export interface VideoDetails {
  videoId: string
  title: string
  thumbnail: string
  duration: string
  channelTitle: string
  tags?: string[]
  description?: string
}

export interface SummaryResult {
  success: boolean
  videoId?: string
  error?: string
  summary?: string
  videoDetails?: VideoDetails
}

export interface User {
  id: string
  email?: string
  user_metadata?: any
}

export interface VideoSummary {
  id: string
  video_id: string
  user_id: string
  summary: string
  language: string
  model: AIModel
  prompt_type: PromptType
  created_at: string
  video_info?: {
    video_id: string
    video_title: string
    video_thumbnail: string
    video_duration: string
    channel_title: string
    video_tags?: string[]
    video_description?: string
  }
}