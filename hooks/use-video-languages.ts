import { useState, useEffect, useCallback } from 'react'

export interface LanguageOption {
  language: string;
  created_at: string;
  summary_id: string;
}

interface VideoLanguagesCache {
  [videoId: string]: {
    languages: LanguageOption[];
    timestamp: number;
    isLoading: boolean;
  }
}

// Global cache to prevent duplicate API calls
const languagesCache: VideoLanguagesCache = {}
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Active request promises to prevent duplicate concurrent requests
const activeRequests = new Map<string, Promise<LanguageOption[]>>()

export function useVideoLanguages(videoId: string | null) {
  const [languages, setLanguages] = useState<LanguageOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLanguages = useCallback(async (targetVideoId: string): Promise<LanguageOption[]> => {
    // Check if there's already an active request for this video
    if (activeRequests.has(targetVideoId)) {
      console.log(`[useVideoLanguages] Using active request for ${targetVideoId}`)
      return activeRequests.get(targetVideoId)!
    }

    // Check cache first
    const cached = languagesCache[targetVideoId]
    const now = Date.now()
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION && !cached.isLoading) {
      console.log(`[useVideoLanguages] Using cached data for ${targetVideoId}`)
      return cached.languages
    }

    // Mark as loading in cache
    languagesCache[targetVideoId] = {
      languages: cached?.languages || [],
      timestamp: now,
      isLoading: true
    }

    // Create the API request promise
    const requestPromise = fetch(`/api/video-languages?videoId=${encodeURIComponent(targetVideoId)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.json()
        const languages = data.languages || []
        
        // Update cache with results
        languagesCache[targetVideoId] = {
          languages,
          timestamp: Date.now(),
          isLoading: false
        }
        
        console.log(`[useVideoLanguages] Fetched and cached ${languages.length} languages for ${targetVideoId}`)
        return languages
      })
      .catch((error) => {
        // Clear loading state on error
        if (languagesCache[targetVideoId]) {
          languagesCache[targetVideoId].isLoading = false
        }
        console.error(`[useVideoLanguages] Error fetching languages for ${targetVideoId}:`, error)
        throw error
      })
      .finally(() => {
        // Remove from active requests when done
        activeRequests.delete(targetVideoId)
      })

    // Store the promise to prevent duplicate requests
    activeRequests.set(targetVideoId, requestPromise)
    
    return requestPromise
  }, [])

  const refreshLanguages = useCallback(async (targetVideoId?: string) => {
    const refreshVideoId = targetVideoId || videoId
    if (!refreshVideoId) return

    console.log(`[useVideoLanguages] Force refreshing languages for ${refreshVideoId}`)
    
    // Clear cache for this video
    delete languagesCache[refreshVideoId]
    activeRequests.delete(refreshVideoId)
    
    setIsLoading(true)
    setError(null)
    
    try {
      const newLanguages = await fetchLanguages(refreshVideoId)
      setLanguages(newLanguages)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch languages'
      setError(errorMessage)
      setLanguages([])
    } finally {
      setIsLoading(false)
    }
  }, [videoId, fetchLanguages])

  // Load languages when videoId changes
  useEffect(() => {
    if (!videoId) {
      setLanguages([])
      setIsLoading(false)
      setError(null)
      return
    }

    // Check cache first
    const cached = languagesCache[videoId]
    const now = Date.now()
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION && !cached.isLoading) {
      console.log(`[useVideoLanguages] Using cached languages for ${videoId}`)
      setLanguages(cached.languages)
      setIsLoading(false)
      setError(null)
      return
    }

    // If already loading, wait for it
    if (cached?.isLoading || activeRequests.has(videoId)) {
      console.log(`[useVideoLanguages] Request already in progress for ${videoId}`)
      setIsLoading(true)
      setError(null)
      
      // Wait for the active request to complete
      const waitForRequest = async () => {
        try {
          const result = await (activeRequests.get(videoId) || fetchLanguages(videoId))
          setLanguages(result)
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch languages'
          setError(errorMessage)
          setLanguages([])
        } finally {
          setIsLoading(false)
        }
      }
      
      waitForRequest()
      return
    }

    // Fetch new data
    setIsLoading(true)
    setError(null)
    
    const loadLanguages = async () => {
      try {
        const newLanguages = await fetchLanguages(videoId)
        setLanguages(newLanguages)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch languages'
        setError(errorMessage)
        setLanguages([])
      } finally {
        setIsLoading(false)
      }
    }

    loadLanguages()
  }, [videoId, fetchLanguages])

  return {
    languages,
    isLoading,
    error,
    refreshLanguages
  }
}

// Utility function to clear cache (useful for testing or manual cache invalidation)
export function clearVideoLanguagesCache(videoId?: string) {
  if (videoId) {
    delete languagesCache[videoId]
    activeRequests.delete(videoId)
    console.log(`[useVideoLanguages] Cleared cache for ${videoId}`)
  } else {
    Object.keys(languagesCache).forEach(key => delete languagesCache[key])
    activeRequests.clear()
    console.log(`[useVideoLanguages] Cleared entire cache`)
  }
}