import { supabase } from '../lib/supabase'
import { extractYoutubeVideoId } from '../lib/youtube-utils'
import type { AIModel, PromptType, SupportedLanguage, SummaryResult, VideoSummary } from '../types'

/**
 * Summarize YouTube video - mobile version
 * This would need to call the web app's API endpoints or replicate the logic
 */
export async function summarizeYoutubeVideo(
  url: string,
  model: AIModel = 'gemini-2.5-flash',
  language: SupportedLanguage = 'ko',
  promptType: PromptType = 'general_summary'
): Promise<SummaryResult> {
  try {
    const videoId = extractYoutubeVideoId(url)
    if (!videoId) {
      return {
        success: false,
        error: 'Invalid YouTube URL'
      }
    }

    // For now, this is a placeholder - we would need to implement the actual API call
    // In a real implementation, this would either:
    // 1. Call the existing web app's API endpoints
    // 2. Replicate the server actions logic
    // 3. Use a shared backend service

    console.log('Summarizing video:', { videoId, model, language, promptType })
    
    // Placeholder response
    return {
      success: false,
      error: 'API integration not yet implemented'
    }
  } catch (error) {
    console.error('Error summarizing video:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get user's video summaries
 */
export async function getUserSummaries(userId: string): Promise<VideoSummary[]> {
  try {
    const { data, error } = await supabase
      .from('video_summaries')
      .select(`
        *,
        video_info:video_info_id (
          video_id,
          video_title,
          video_thumbnail,
          video_duration,
          channel_title,
          video_tags,
          video_description
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching summaries:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching summaries:', error)
    return []
  }
}

/**
 * Get specific video summary
 */
export async function getVideoSummary(
  videoId: string,
  userId: string,
  language?: string
): Promise<VideoSummary | null> {
  try {
    let query = supabase
      .from('video_summaries')
      .select(`
        *,
        video_info:video_info_id (
          video_id,
          video_title,
          video_thumbnail,
          video_duration,
          channel_title,
          video_tags,
          video_description
        )
      `)
      .eq('user_id', userId)
      .eq('video_info.video_id', videoId)

    if (language) {
      query = query.eq('language', language)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // No data found
      }
      console.error('Error fetching video summary:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error fetching video summary:', error)
    return null
  }
}