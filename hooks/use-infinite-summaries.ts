import { useState, useEffect, useCallback, useRef } from 'react';

export interface Summary {
  video_id: string;
  title: string;
  thumbnail_url: string;
  channel_title: string;
  created_at: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UseSummariesOptions {
  userId?: string;
  enabled?: boolean;
  pageSize?: number;
}

interface UseSummariesReturn {
  summaries: Summary[];
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  loadNextPage: () => Promise<void>;
  refresh: () => Promise<void>;
  pagination: PaginationInfo | null;
}

export function useInfiniteSummaries({ 
  userId, 
  enabled = true, 
  pageSize = 20 
}: UseSummariesOptions = {}): UseSummariesReturn {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);

  const fetchSummaries = useCallback(async (page: number, reset = false) => {
    console.log('[useInfiniteSummaries] fetchSummaries called:', { page, reset, userId, enabled });
    if (!enabled || isLoadingRef.current) {
      console.log('[useInfiniteSummaries] fetchSummaries skipped:', { enabled, isLoading: isLoadingRef.current });
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (userId) {
        params.append('userId', userId);
      }

      const url = `/api/summaries?${params}`;
      console.log('[useInfiniteSummaries] Fetching:', url);

      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[useInfiniteSummaries] Response received:', data);

      if (reset) {
        setSummaries(data.summaries);
      } else {
        setSummaries(prev => [...prev, ...data.summaries]);
      }

      setPagination(data.pagination);

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }

      console.error('Error fetching summaries:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch summaries');
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [userId, enabled, pageSize]);

  const loadNextPage = useCallback(async () => {
    if (!pagination?.hasNextPage || loading) return;
    
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await fetchSummaries(nextPage, false);
  }, [pagination?.hasNextPage, loading, currentPage, fetchSummaries]);

  const refresh = useCallback(async () => {
    setCurrentPage(1);
    await fetchSummaries(1, true);
  }, [fetchSummaries]);

  // Initial load and when dependencies change
  useEffect(() => {
    console.log('[useInfiniteSummaries] Effect triggered:', { userId, enabled });
    if (enabled) {
      setCurrentPage(1);
      setSummaries([]); // 사용자 변경 시 이전 데이터 클리어
      fetchSummaries(1, true);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [userId, enabled]); // Don't include fetchSummaries to avoid infinite loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    summaries,
    loading,
    error,
    hasNextPage: pagination?.hasNextPage || false,
    loadNextPage,
    refresh,
    pagination
  };
}