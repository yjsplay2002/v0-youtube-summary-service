'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/auth-context';
import { getCuratedVideos } from '@/app/actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayCircle, Clock, User, X, Sparkles } from 'lucide-react';
import YouTube from 'react-youtube';

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

// 비디오 길이를 초 단위로 변환
function parseDurationToSeconds(duration: string): number {
  if (!duration || duration === 'Unknown') return 0;
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

// 쇼츠 비디오인지 확인 (60초 이하)
function isShorts(duration: string): boolean {
  if (!duration || duration === 'Unknown') return false;
  return parseDurationToSeconds(duration) <= 60;
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
  const [isClient, setIsClient] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null);
  
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Ensure this component only renders properly on client-side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 초기 비디오 로드
  const loadInitialVideos = async () => {
    try {
      console.log('[CurationSection] Loading initial videos for user:', user?.id || 'guest');
      setLoading(true);
      setError(null);
      const result = await getCuratedVideos(user?.id);
      
      if (result && result.items) {
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
      setError('비디오를 불러오는데 실패했습니다. API 키가 설정되지 않았을 수 있습니다.');
      setVideos([]);
      setHasMore(false);
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
      
      if (result && result.items && result.items.length > 0) {
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

  const lastVideoElementRef = useCallback((node: HTMLDivElement) => {
    if (!isClient || loadingMore) return;
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
  }, [loadingMore, hasMore, loadMoreVideos, isClient]);

  // 비디오 클릭 핸들러
  const handleVideoClick = (videoId: string, event: React.MouseEvent) => {
    try {
      // 이미 선택된 비디오를 다시 클릭한 경우 전체화면으로 재생
      if (selectedVideo === videoId) {
        setFullscreenVideo(videoId);
        return;
      }
      
      // 새로운 비디오 선택
      setSelectedVideo(videoId);
      
      // 기존 URL 입력 필드에 채우는 기능도 유지
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      if (typeof window !== 'undefined' && window.postMessage) {
        window.postMessage({ type: 'FILL_YOUTUBE_URL', url: youtubeUrl }, '*');
      }
    } catch (error) {
      console.error('[CurationSection] Error in handleVideoClick:', error);
    }
  };

  // 요약 버튼 클릭 핸들러
  const handleSummarizeClick = (videoId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 비디오 클릭 이벤트 전파 방지
    try {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      if (typeof window !== 'undefined' && window.postMessage) {
        window.postMessage({ type: 'FILL_YOUTUBE_URL', url: youtubeUrl }, '*');
      }
      // 선택 해제
      setSelectedVideo(null);
    } catch (error) {
      console.error('[CurationSection] Error in handleSummarizeClick:', error);
    }
  };

  // 전체화면 비디오 닫기
  const handleCloseFullscreen = () => {
    setFullscreenVideo(null);
  };

  useEffect(() => {
    if (isClient) {
      loadInitialVideos();
    }
  }, [user?.id, isClient]);

  // 외부 클릭 시 선택 해제
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.video-card') && !target.closest('.summarize-button')) {
        setSelectedVideo(null);
      }
    };

    if (selectedVideo) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [selectedVideo]);

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
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 mb-6">
          {[...Array(8)].map((_, i) => (
            <Card key={`shorts-loading-${i}`} className="overflow-hidden">
              <Skeleton className="aspect-[9/16] w-full" />
            </Card>
          ))}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={`video-loading-${i}`} className="overflow-hidden">
              <Skeleton className="aspect-video w-full" />
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
      
      {/* 쇼츠 비디오들 */}
      {videos.filter(video => isShorts(video.duration)).length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Shorts</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {videos.filter(video => isShorts(video.duration)).map((video, index, filteredVideos) => {
              // Find the original index of this video in the full videos array
              const originalIndex = videos.findIndex(v => v.id === video.id);
              const isLastVideo = originalIndex === videos.length - 1;
              
              return (
                <div key={`shorts-${video.id}-${index}`} className="video-card relative">
                  <Card 
                    className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer group ${
                      selectedVideo === video.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={(e) => handleVideoClick(video.id, e)}
                    ref={isLastVideo ? lastVideoElementRef : null}
                  >
                    <div className="relative aspect-[9/16] overflow-hidden">
                      <img 
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      {video.duration && (
                        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded text-[10px]">
                          <Clock className="inline h-2 w-2 mr-0.5" />
                          {formatDuration(video.duration)}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                        <PlayCircle className="h-8 w-8 text-white opacity-0 group-hover:opacity-90 transition-opacity duration-200" />
                      </div>
                    </div>
                  </Card>
                  
                  {/* 요약 버튼 */}
                  {selectedVideo === video.id && (
                    <Button
                      className="summarize-button absolute -bottom-2 -right-2 h-8 w-8 p-0 rounded-full bg-primary hover:bg-primary/90 shadow-lg z-10"
                      onClick={(e) => handleSummarizeClick(video.id, e)}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* 일반 비디오들 */}
      {videos.filter(video => !isShorts(video.duration)).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Videos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.filter(video => !isShorts(video.duration)).map((video, index) => {
              // Find the original index of this video in the full videos array
              const originalIndex = videos.findIndex(v => v.id === video.id);
              const isLastVideo = originalIndex === videos.length - 1;
              
              return (
                <div key={`video-${video.id}-${index}`} className="video-card relative">
                  <Card 
                    className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer group ${
                      selectedVideo === video.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={(e) => handleVideoClick(video.id, e)}
                    ref={isLastVideo ? lastVideoElementRef : null}
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
                  </Card>
                  
                  {/* 요약 버튼 */}
                  {selectedVideo === video.id && (
                    <Button
                      className="summarize-button absolute -bottom-2 -right-2 h-10 w-10 p-0 rounded-full bg-primary hover:bg-primary/90 shadow-lg z-10"
                      onClick={(e) => handleSummarizeClick(video.id, e)}
                    >
                      <Sparkles className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {loadingMore && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {[...Array(3)].map((_, i) => (
            <Card key={`loading-${i}`} className="overflow-hidden">
              <Skeleton className="aspect-video w-full" />
            </Card>
          ))}
        </div>
      )}
      
      {!hasMore && videos.length > 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">더 이상 불러올 동영상이 없습니다.</p>
        </div>
      )}
      
      {/* 전체화면 비디오 플레이어 */}
      {fullscreenVideo && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
          <div className="relative w-full h-full max-w-6xl max-h-[90vh] flex items-center justify-center">
            <Button
              className="absolute top-4 right-4 z-60 bg-black/50 hover:bg-black/70 text-white"
              onClick={handleCloseFullscreen}
              size="sm"
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="w-full h-full">
              <YouTube
                videoId={fullscreenVideo}
                className="w-full h-full"
                iframeClassName="w-full h-full"
                opts={{
                  width: '100%',
                  height: '100%',
                  playerVars: {
                    autoplay: 1,
                    rel: 0,
                    modestbranding: 1,
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}