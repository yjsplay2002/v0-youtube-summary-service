"use client";

import { useEffect, useRef, useCallback } from 'react';

interface InfiniteScrollProps {
  hasNextPage: boolean;
  loading: boolean;
  loadNext: () => void;
  threshold?: number;
  children: React.ReactNode;
  className?: string;
}

export function InfiniteScroll({
  hasNextPage,
  loading,
  loadNext,
  threshold = 100,
  children,
  className
}: InfiniteScrollProps) {
  const loadingRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    
    if (entry.isIntersecting && hasNextPage && !loading && !loadingRef.current) {
      loadingRef.current = true;
      loadNext();
      
      // Reset loading flag after a short delay
      setTimeout(() => {
        loadingRef.current = false;
      }, 1000);
    }
  }, [hasNextPage, loading, loadNext]);

  useEffect(() => {
    if (!sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: `${threshold}px`,
      threshold: 0.1
    });

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, threshold]);

  return (
    <div className={className}>
      {children}
      {/* Sentinel element for intersection observer */}
      <div ref={sentinelRef} className="h-1" />
    </div>
  );
}