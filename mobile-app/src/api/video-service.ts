import { supabase } from '../lib/supabase'
import { apiClient } from '../lib/api-client'
import { extractYoutubeVideoId } from '../lib/youtube-utils'
import type { AIModel, PromptType, SupportedLanguage, SummaryResult, VideoSummary } from '../types'

/**
 * Summarize YouTube video by calling the web app's API
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

    // Call the web app's summarization API
    const result = await apiClient.post<SummaryResult>('/api/video-summaries', {
      url,
      model,
      language,
      promptType,
    })

    return result
  } catch (error) {
    console.error('Error summarizing video:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to summarize video'
    }
  }
}

/**
 * Get video details from YouTube
 */
export async function getVideoDetails(videoId: string) {
  try {
    const result = await apiClient.get(`/api/video-details`, { videoId })
    return result
  } catch (error) {
    console.error('Error fetching video details:', error)
    return null
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

/**
 * Delete a video summary
 */
export async function deleteVideoSummary(summaryId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('video_summaries')
      .delete()
      .eq('id', summaryId)

    if (error) {
      console.error('Error deleting summary:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error deleting summary:', error)
    return false
  }
}