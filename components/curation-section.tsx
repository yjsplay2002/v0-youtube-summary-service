'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/auth-context';
import { getCuratedVideos, summarizeYoutubeVideo } from '@/app/actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayCircle, Clock, User, Sparkles, ExternalLink } from 'lucide-react';
import YouTube from 'react-youtube';
import { useRouter } from 'next/navigation';
import { useSummaryContext } from '@/components/summary-context';
import { useToast } from '@/hooks/use-toast';

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
  const router = useRouter();
  const { refreshSummaries } = useSummaryContext();
  const { toast } = useToast();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [completedSummaries, setCompletedSummaries] = useState<Set<string>>(new Set());
  const [unplayableVideos, setUnplayableVideos] = useState<Set<string>>(new Set());
  
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

  // 요약 버튼 클릭 핸들러 - 새로운 플로우로 수정
  const handleSummarizeClick = async (videoId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 비디오 클릭 이벤트 전파 방지
    
    // 이미 완료된 요약이 있다면 결과 페이지로 이동
    if (completedSummaries.has(videoId)) {
      router.push(`/?videoId=${videoId}`);
      return;
    }
    
    try {
      setSummarizing(videoId);
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      // 요약 프로세스 실행
      const result = await summarizeYoutubeVideo(youtubeUrl, 'claude-3-5-haiku', undefined, user?.id, 'general_summary');
      
      if (result.success && result.videoId) {
        // 요약 완료 상태 추가
        setCompletedSummaries(prev => new Set(prev).add(videoId));
        refreshSummaries();
        
        // 요약 완료 토스트 표시
        toast({
          title: "요약 완료",
          description: "비디오 요약이 성공적으로 완료되었습니다.",
          duration: 3000,
        });
        
        // 선택 유지 (버튼이 "요약 보러가기"로 변경됨)
      } else {
        console.error('[CurationSection] Summarization failed:', result.error);
        toast({
          title: "요약 실패",
          description: "비디오 요약에 실패했습니다. 다시 시도해주세요.",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('[CurationSection] Error in handleSummarizeClick:', error);
      toast({
        title: "오류 발생",
        description: "요약 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setSummarizing(null);
    }
  };

  // YouTube 플레이어 에러 핸들러
  const handlePlayerError = useCallback((videoId: string, error: any) => {
    console.warn(`[CurationSection] YouTube player error for video ${videoId}:`, error);
    setUnplayableVideos(prev => new Set(prev).add(videoId));
  }, []);

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

  // 재생 가능한 비디오만 필터링
  const playableVideos = videos.filter(video => !unplayableVideos.has(video.id));

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

  if (playableVideos.length === 0 && !loading) {
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
      {playableVideos.filter(video => isShorts(video.duration)).length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Shorts</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {playableVideos.filter(video => isShorts(video.duration)).map((video, index, filteredVideos) => {
              // Find the original index of this video in the full videos array
              const originalIndex = playableVideos.findIndex(v => v.id === video.id);
              const isLastVideo = originalIndex === playableVideos.length - 1;
              
              return (
                <div key={`shorts-${video.id}-${index}`} className="video-card relative">
                  <Card 
                    className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer group ${
                      selectedVideo === video.id ? 'ring-2 ring-primary' : ''
                    }`}
                    ref={isLastVideo ? lastVideoElementRef : null}
                  >
                    <div className="relative aspect-[9/16] overflow-hidden">
                      <YouTube
                        videoId={video.id}
                        className="w-full h-full"
                        iframeClassName="w-full h-full"
                        opts={{
                          width: '100%',
                          height: '100%',
                          playerVars: {
                            rel: 0,
                            modestbranding: 1,
                          },
                        }}
                        onStateChange={(event) => {
                          // 비디오 플레이어 클릭시 선택되도록 처리
                          if (event.data === 1) { // playing state
                            setSelectedVideo(video.id);
                          }
                        }}
                        onError={(error) => handlePlayerError(video.id, error)}
                      />
                      {video.duration && (
                        <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 py-0.5 rounded text-[10px] pointer-events-none z-10">
                          <Clock className="inline h-2 w-2 mr-0.5" />
                          {formatDuration(video.duration)}
                        </div>
                      )}
                    </div>
                  </Card>
                  
                  {/* 요약 버튼 */}
                  {selectedVideo === video.id && (
                    <Button
                      className="summarize-button absolute -bottom-2 -right-2 h-8 w-8 p-0 rounded-full bg-primary hover:bg-primary/90 shadow-lg z-20"
                      onClick={(e) => handleSummarizeClick(video.id, e)}
                      disabled={summarizing === video.id}
                    >
                      {summarizing === video.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : completedSummaries.has(video.id) ? (
                        <ExternalLink className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* 일반 비디오들 */}
      {playableVideos.filter(video => !isShorts(video.duration)).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Videos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playableVideos.filter(video => !isShorts(video.duration)).map((video, index) => {
              // Find the original index of this video in the full videos array
              const originalIndex = playableVideos.findIndex(v => v.id === video.id);
              const isLastVideo = originalIndex === playableVideos.length - 1;
              
              return (
                <div key={`video-${video.id}-${index}`} className="video-card relative">
                  <Card 
                    className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer group ${
                      selectedVideo === video.id ? 'ring-2 ring-primary' : ''
                    }`}
                    ref={isLastVideo ? lastVideoElementRef : null}
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <YouTube
                        videoId={video.id}
                        className="w-full h-full"
                        iframeClassName="w-full h-full"
                        opts={{
                          width: '100%',
                          height: '100%',
                          playerVars: {
                            rel: 0,
                            modestbranding: 1,
                          },
                        }}
                        onStateChange={(event) => {
                          // 비디오 플레이어 클릭시 선택되도록 처리
                          if (event.data === 1) { // playing state
                            setSelectedVideo(video.id);
                          }
                        }}
                        onError={(error) => handlePlayerError(video.id, error)}
                      />
                      {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none z-10">
                          <Clock className="inline h-3 w-3 mr-1" />
                          {formatDuration(video.duration)}
                        </div>
                      )}
                    </div>
                  </Card>
                  
                  {/* 요약 버튼 */}
                  {selectedVideo === video.id && (
                    <Button
                      className="summarize-button absolute -bottom-2 -right-2 h-10 w-10 p-0 rounded-full bg-primary hover:bg-primary/90 shadow-lg z-20"
                      onClick={(e) => handleSummarizeClick(video.id, e)}
                      disabled={summarizing === video.id}
                    >
                      {summarizing === video.id ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : completedSummaries.has(video.id) ? (
                        <ExternalLink className="h-5 w-5" />
                      ) : (
                        <Sparkles className="h-5 w-5" />
                      )}
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
    </div>
  );
}