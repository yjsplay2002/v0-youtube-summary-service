'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/auth-context';
import { getCuratedVideos } from '@/app/actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayCircle, Clock, User } from 'lucide-react';

interface VideoItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  description?: string;
}

interface CurationSectionProps {
  className?: string;
}

// 비디오 길이를 사람이 읽기 쉬운 형태로 변환
function formatDuration(duration: string): string {
  if (!duration || duration === 'Unknown') return '';
  
  // PT15M33S 형태를 15:33 형태로 변환
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

// 날짜를 상대적 형태로 변환
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 1) return '1일 전';
  if (diffDays <= 7) return `${diffDays}일 전`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)}주 전`;
  if (diffDays <= 365) return `${Math.ceil(diffDays / 30)}개월 전`;
  return `${Math.ceil(diffDays / 365)}년 전`;
}

export default function CurationSection({ className }: CurationSectionProps) {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastVideoElementRef = useCallback((node: HTMLDivElement) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        console.log('[CurationSection] Intersection detected, loading more videos...');
        loadMoreVideos();
      }
    }, {
      threshold: 0.1,
      rootMargin: '50px'
    });
    
    if (node) {
      console.log('[CurationSection] Attaching observer to last video element');
      observerRef.current.observe(node);
    }
  }, [loadingMore, hasMore, loadMoreVideos]);

  // 초기 비디오 로드
  const loadInitialVideos = async () => {
    try {
      console.log('[CurationSection] Loading initial videos for user:', user?.id || 'guest');
      setLoading(true);
      setError(null);
      const result = await getCuratedVideos(user?.id);
      
      if (result.items) {
        console.log(`[CurationSection] Loaded ${result.items.length} initial videos`);
        setVideos(result.items);
        setNextPageToken(result.nextPageToken);
        setHasMore(!!result.nextPageToken);
        console.log('[CurationSection] Initial load state:', { 
          videosCount: result.items.length, 
          nextPageToken: result.nextPageToken, 
          hasMore: !!result.nextPageToken 
        });
      } else {
        console.log('[CurationSection] No videos returned from initial load');
        setVideos([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error('[CurationSection] Error loading videos:', err);
      setError('비디오를 불러오는데 실패했습니다.');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  // 추가 비디오 로드 (무한 스크롤)
  const loadMoreVideos = useCallback(async () => {
    if (!hasMore || loadingMore || !nextPageToken) {
      console.log('[CurationSection] Skipping loadMoreVideos:', { hasMore, loadingMore, nextPageToken });
      return;
    }
    
    console.log('[CurationSection] Loading more videos with pageToken:', nextPageToken);
    
    try {
      setLoadingMore(true);
      const result = await getCuratedVideos(user?.id, nextPageToken);
      
      if (result.items && result.items.length > 0) {
        console.log(`[CurationSection] Loaded ${result.items.length} more videos`);
        setVideos(prev => [...prev, ...result.items]);
        setNextPageToken(result.nextPageToken);
        setHasMore(!!result.nextPageToken);
      } else {
        console.log('[CurationSection] No more videos to load');
        setHasMore(false);
      }
    } catch (err) {
      console.error('[CurationSection] Error loading more videos:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextPageToken, user?.id]);

  // 비디오 클릭 핸들러
  const handleVideoClick = (videoId: string) => {
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    // 같은 페이지에서 URL 입력 필드에 채우기 위해 커스텀 이벤트 발송
    window.postMessage({ type: 'FILL_YOUTUBE_URL', url: youtubeUrl }, '*');
    
    // 또는 새 탭에서 YouTube로 바로 이동
    // window.open(youtubeUrl, '_blank');
  };

  useEffect(() => {
    loadInitialVideos();
  }, [user?.id]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className={className}>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">
            {user ? '맞춤 추천' : '인기 동영상'}
          </h2>
          <p className="text-muted-foreground">
            {user 
              ? '당신의 관심사를 바탕으로 추천된 동영상들입니다' 
              : '현재 인기 있는 동영상들을 확인해보세요'
            }
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadInitialVideos} variant="outline">
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className={className}>
        <div className="text-center py-8">
          <PlayCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {user 
              ? '추천할 동영상이 없습니다. 더 많은 동영상을 요약해보세요!' 
              : '동영상을 불러올 수 없습니다.'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">
          {user ? '맞춤 추천' : '인기 동영상'}
        </h2>
        <p className="text-muted-foreground">
          {user 
            ? '당신의 관심사를 바탕으로 추천된 동영상들입니다' 
            : '현재 인기 있는 동영상들을 확인해보세요'
          }
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video, index) => (
          <Card 
            key={`${video.id}-${index}`}
            className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => handleVideoClick(video.id)}
            ref={index === videos.length - 1 ? lastVideoElementRef : null}
          >
            <div className="relative aspect-video overflow-hidden">
              <img 
                src={video.thumbnail}
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
              {video.duration && (
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                  <Clock className="inline h-3 w-3 mr-1" />
                  {formatDuration(video.duration)}
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                <PlayCircle className="h-12 w-12 text-white opacity-0 group-hover:opacity-90 transition-opacity duration-200" />
              </div>
            </div>
            
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                {video.title}
              </h3>
              
              <div className="flex items-center text-xs text-muted-foreground mb-1">
                <User className="h-3 w-3 mr-1" />
                <span className="truncate">{video.channelTitle}</span>
              </div>
              
              <div className="text-xs text-muted-foreground">
                {formatRelativeDate(video.publishedAt)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {loadingMore && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {[...Array(3)].map((_, i) => (
            <Card key={`loading-${i}`} className="overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {!hasMore && videos.length > 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">더 이상 불러올 동영상이 없습니다.</p>
        </div>
      )}
    </div>
  );
}