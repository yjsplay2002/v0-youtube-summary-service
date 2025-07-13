/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYoutubeVideoId(url: string): string | null {
  try {
    // Handle different YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return null
  } catch (error) {
    console.error('Error extracting video ID:', error)
    return null
  }
}

/**
 * Generate YouTube URL from video ID
 */
export function generateYoutubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/**
 * Validate YouTube URL or video ID
 */
export function isValidYoutubeUrl(input: string): boolean {
  return extractYoutubeVideoId(input) !== null
}