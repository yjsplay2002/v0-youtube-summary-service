'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/auth-context';
import { getUserKeywords, getGuestKeywords, searchVideosByKeyword, checkVideoSummaryExists } from '@/app/actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Clock, User, Sparkles, Tag, Loader2, X, Eye, FileText } from 'lucide-react';
import YouTube from 'react-youtube';
import { toast } from 'sonner';

interface VideoItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  description?: string;
}

interface UserKeyword {
  keyword: string;
  frequency: number;
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
  const [keywords, setKeywords] = useState<UserKeyword[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [keywordsLoading, setKeywordsLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [videoSummaryStatus, setVideoSummaryStatus] = useState<{[videoId: string]: boolean}>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false); // 중복 호출 방지용 ref

  // 유저(또는 게스트)의 키워드 추출
  const fetchKeywords = async () => {
    try {
      setKeywordsLoading(true);
      setError(null);
      
      let keywordData: UserKeyword[];
      if (user) {
        // 로그인한 사용자: 개인 키워드
        keywordData = await getUserKeywords(user.id);
      } else {
        // 게스트 사용자: 게스트 키워드
        keywordData = await getGuestKeywords();
      }
      
      setKeywords(keywordData || []);
    } catch (err) {
      console.error('키워드 로딩 실패:', err);
      setError('키워드를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setKeywordsLoading(false);
    }
  };

  // 비디오 요약 상태 확인
  const checkVideoSummaryStatus = async (videoIds: string[]) => {
    const statusPromises = videoIds.map(async (videoId) => {
      const exists = await checkVideoSummaryExists(videoId, user?.id);
      return { videoId, exists };
    });
    
    const results = await Promise.all(statusPromises);
    const statusMap = results.reduce((acc, { videoId, exists }) => {
      acc[videoId] = exists;
      return acc;
    }, {} as {[videoId: string]: boolean});
    
    setVideoSummaryStatus(prev => ({ ...prev, ...statusMap }));
  };

  // 선택된 키워드로 관련 동영상 검색
  const searchVideosForKeyword = async (keyword: string, append: boolean = false) => {
    try {
      // 중복 호출 방지
      if (append && isLoadingMoreRef.current) {
        console.log('Already loading more videos, skipping...');
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('searchVideosForKeyword called:', { keyword, append, nextPageToken, hasMore });
      }
      
      if (!append) {
        setVideosLoading(true);
        setVideos([]);
        setHasMore(true);
        setNextPageToken(undefined);
        isLoadingMoreRef.current = false;
      } else {
        setLoadingMore(true);
        isLoadingMoreRef.current = true;
      }
      setError(null);
      
      const currentPageToken = append ? nextPageToken : undefined;
      
      const searchResult = await searchVideosByKeyword(keyword, 10, currentPageToken);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Search result:', { 
          videosCount: searchResult.videos.length, 
          nextPageToken: searchResult.nextPageToken 
        });
      }
      
      if (append) {
        // 중복 제거: 기존 비디오 ID와 새로운 비디오 ID를 비교
        setVideos(prev => {
          const existingIds = new Set(prev.map(v => v.id));
          const newVideos = searchResult.videos.filter(video => !existingIds.has(video.id));
          
          if (process.env.NODE_ENV === 'development') {
            console.log('Adding new videos:', { existing: prev.length, new: newVideos.length });
          }
          
          return [...prev, ...newVideos];
        });
        
        // 새로운 비디오가 없거나 다음 페이지 토큰이 없으면 더 이상 로드할 것이 없다고 간주
        if (searchResult.videos.length === 0 || !searchResult.nextPageToken) {
          if (process.env.NODE_ENV === 'development') {
            console.log('No more videos to load');
          }
          setHasMore(false);
        }
        
        // 새 비디오들의 요약 상태 확인
        if (searchResult.videos.length > 0) {
          const newVideoIds = searchResult.videos.map(v => v.id);
          await checkVideoSummaryStatus(newVideoIds);
        }
      } else {
        setVideos(searchResult.videos);
        
        // 비디오들의 요약 상태 확인
        if (searchResult.videos.length > 0) {
          await checkVideoSummaryStatus(searchResult.videos.map(v => v.id));
        }
        
        // 첫 번째 로드에서 결과가 적거나 nextPageToken이 없으면 hasMore를 false로 설정
        if (searchResult.videos.length < 10 || !searchResult.nextPageToken) {
          setHasMore(false);
        }
      }
      
      // 페이지 토큰 업데이트
      setNextPageToken(searchResult.nextPageToken);
      
    } catch (err) {
      console.error('동영상 검색 실패:', err);
      setError('동영상을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setVideosLoading(false);
      setLoadingMore(false);
      isLoadingMoreRef.current = false;
    }
  };

  // 더 많은 동영상 로드
  const loadMoreVideos = useCallback(() => {
    if (selectedKeyword && !loadingMore && hasMore) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Loading more videos:', { selectedKeyword, loadingMore, hasMore, nextPageToken });
      }
      searchVideosForKeyword(selectedKeyword, true);
    }
  }, [selectedKeyword, loadingMore, hasMore, nextPageToken]);

  // 스크롤 이벤트 핸들러
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loadingMore || !hasMore || !selectedKeyword) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    // 90% 스크롤했을 때 더 로드
    if (scrollPercentage >= 0.9) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Scroll threshold reached:', { 
          scrollPercentage: Math.round(scrollPercentage * 100) + '%',
          loadingMore,
          hasMore,
          selectedKeyword
        });
      }
      loadMoreVideos();
    }
  }, [loadMoreVideos, loadingMore, hasMore, selectedKeyword]);

  // 스크롤 이벤트 리스너 등록
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // 스크롤 이벤트 디바운싱
    let timeoutId: NodeJS.Timeout;
    const debouncedScroll = (e: Event) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handleScroll(), 100);
    };
    
    container.addEventListener('scroll', debouncedScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', debouncedScroll);
      clearTimeout(timeoutId);
    };
  }, [handleScroll]);

  // 태그 선택 핸들러
  const handleKeywordSelect = (keyword: string) => {
    if (selectedKeyword === keyword) return; // 이미 선택된 키워드면 무시
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Keyword selected:', keyword);
    }
    
    // 모든 상태 초기화
    setSelectedKeyword(keyword);
    setVideos([]); 
    setHasMore(true);
    setSelectedVideo(null); 
    setNextPageToken(undefined);
    setLoadingMore(false);
    isLoadingMoreRef.current = false;
    
    searchVideosForKeyword(keyword);
  };

  // 비디오 클릭 핸들러 (한 번 클릭으로 바로 전체화면)
  const handleVideoClick = (video: VideoItem) => {
    setSelectedVideo(video);
    setShowFullscreen(true);
  };

  // 요약 버튼 클릭 핸들러 (개선된 버전)
  const handleSummarizeClick = async () => {
    if (!selectedVideo) return;
    
    const videoId = selectedVideo.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // 이미 요약이 존재하는 경우 메인 페이지로 이동하여 해당 비디오 표시
    if (videoSummaryStatus[videoId]) {
      window.location.href = `/?videoId=${videoId}`;
      return;
    }
    
    // 요약 시작 - 기존 YouTube Form으로 URL 전달
    window.postMessage({
      type: 'FILL_YOUTUBE_URL',
      url: videoUrl
    }, '*');
    
    // 스크롤을 YouTube Form 섹션으로 이동
    const youtubeFormSection = document.getElementById('youtube-form');
    if (youtubeFormSection) {
      youtubeFormSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // 알림 토스트
    toast.success('동영상이 설정되었습니다', {
      description: '아래 요약 폼에서 요약을 시작하세요.',
      duration: 3000,
    });
  };

  // 전체화면 모달 닫기
  const handleCloseFullscreen = () => {
    setShowFullscreen(false);
  };

  // 키보드 이벤트 핸들러 (ESC 키로 전체화면 닫기)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showFullscreen) {
        handleCloseFullscreen();
      }
    };

    if (showFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden'; // 스크롤 방지
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showFullscreen]);

  // 컴포넌트 마운트 시 키워드 로드
  useEffect(() => {
    fetchKeywords();
  }, [user?.id]); // user가 변경될 때마다 다시 로드

  if (keywordsLoading) {
    return (
      <div className={className}>
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">맞춤 추천</h2>
          <p className="text-muted-foreground">
            당신의 시청 기록을 분석하여 관심 키워드를 찾고 있습니다
          </p>
        </div>
        
        {/* 키워드 로딩 스켈레톤 */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
        
        {/* 동영상 로딩 스켈레톤 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-2/3 mb-2" />
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
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchKeywords} variant="outline">
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className={className}>
        <div className="text-center py-8">
          <Tag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {user 
              ? '아직 충분한 시청 기록이 없습니다. 더 많은 동영상을 요약해보세요!' 
              : '아직 게스트 요약 데이터가 충분하지 않습니다. 동영상을 요약하여 키워드를 생성해보세요!'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">맞춤 추천</h2>
        <p className="text-muted-foreground">
          {user ? '시청 기록 분석을 통해 발견된 관심 키워드입니다' : '게스트 사용자를 위한 인기 키워드입니다'}
        </p>
      </div>
      
      {/* 키워드 태그들 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {keywords.map((item) => (
          <Badge
            key={item.keyword}
            variant={selectedKeyword === item.keyword ? "default" : "outline"}
            className={`cursor-pointer px-3 py-1 text-sm transition-all hover:scale-105 ${
              selectedKeyword === item.keyword 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-muted'
            }`}
            onClick={() => handleKeywordSelect(item.keyword)}
          >
            <Tag className="w-3 h-3 mr-1" />
            {item.keyword}
            <span className="ml-1 text-xs opacity-70">({item.frequency})</span>
          </Badge>
        ))}
      </div>

      {/* 선택된 키워드 표시 */}
      {selectedKeyword && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-primary">
            "{selectedKeyword}" 관련 동영상
          </h3>
        </div>
      )}

      {/* 동영상 리스트 - 스크롤 가능한 컨테이너 */}
      {videosLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(10)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video w-full" />
            </Card>
          ))}
        </div>
      ) : videos.length > 0 ? (
        <div 
          ref={scrollContainerRef}
          className="max-h-[80vh] overflow-y-auto pr-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video) => (
              <Card 
                key={video.id} 
                className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group relative"
                onClick={() => handleVideoClick(video)}
              >
                <div className="relative aspect-video overflow-hidden bg-black">
                  <YouTube
                    videoId={video.id}
                    className="w-full h-full"
                    opts={{
                      width: '100%',
                      height: '100%',
                      playerVars: {
                        autoplay: 0,
                        controls: 0,
                        rel: 0,
                        showinfo: 0,
                        modestbranding: 1,
                        fs: 0,
                        disablekb: 1,
                        iv_load_policy: 3,
                        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
                        enablejsapi: 1,
                      },
                    }}
                    onReady={(event) => {
                      try {
                        // 썸네일만 보여주고 자동재생 방지
                        event.target.pauseVideo();
                      } catch (error) {
                        // CORS 에러 무시
                        console.debug('YouTube player ready - CORS error ignored:', error);
                      }
                    }}
                    onError={(error) => {
                      // YouTube 플레이어 에러 무시 (CORS 관련)
                      console.debug('YouTube player error ignored:', error);
                    }}
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(video.duration)}
                  </div>
                </div>
                
                {/* 플로팅 요약 버튼 - 우측 하단 */}
                <div 
                  className="absolute bottom-3 right-3 z-10"
                  onClick={(e) => {
                    e.stopPropagation(); // 카드 클릭 이벤트 방지
                    setSelectedVideo(video);
                    handleSummarizeClick();
                  }}
                >
                  <Button
                    size="sm"
                    variant={videoSummaryStatus[video.id] ? "default" : "secondary"}
                    className="rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 p-2"
                  >
                    {videoSummaryStatus[video.id] ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          
          {/* 무한 스크롤 로딩 인디케이터 */}
          {loadingMore && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">더 많은 동영상을 불러오는 중...</span>
            </div>
          )}
          
          {/* 더 이상 로드할 동영상이 없을 때 */}
          {!hasMore && videos.length > 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">모든 동영상을 불러왔습니다.</p>
            </div>
          )}
        </div>
      ) : selectedKeyword ? (
        <div className="text-center py-8">
          <PlayCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            "{selectedKeyword}" 관련 동영상을 찾을 수 없습니다.
          </p>
        </div>
      ) : (
        <div className="text-center py-8">
          <Tag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            관심 있는 키워드를 선택해보세요!
          </p>
        </div>
      )}

      {/* 전체화면 비디오 모달 */}
      {showFullscreen && selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="relative w-full max-w-6xl aspect-video bg-black rounded-lg overflow-hidden">
            <Button
              onClick={handleCloseFullscreen}
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
            >
              <X className="h-6 w-6" />
            </Button>
            <YouTube
              videoId={selectedVideo.id}
              className="w-full h-full"
              opts={{
                width: '100%',
                height: '100%',
                playerVars: {
                  autoplay: 1,
                  controls: 1,
                  rel: 0,
                  showinfo: 0,
                  modestbranding: 1,
                  fs: 1,
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}