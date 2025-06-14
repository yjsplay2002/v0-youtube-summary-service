'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/auth-context';
import { getUserKeywords, searchVideosByKeyword } from '@/app/actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Clock, User, Sparkles, Tag, Loader2, X } from 'lucide-react';
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 게스트 유저에게는 큐레이션 섹션을 보여주지 않음
  if (!user) {
    return null;
  }

  // 유저의 시청기록에서 키워드 추출
  const fetchUserKeywords = async () => {
    try {
      setKeywordsLoading(true);
      setError(null);
      
      const keywordData = await getUserKeywords(user.id);
      setKeywords(keywordData);
    } catch (err) {
      console.error('키워드 로딩 실패:', err);
      setError('키워드를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setKeywordsLoading(false);
    }
  };

  // 선택된 키워드로 관련 동영상 검색
  const searchVideosForKeyword = async (keyword: string, append: boolean = false) => {
    try {
      if (!append) {
        setVideosLoading(true);
        setVideos([]);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      
      const currentVideoCount = append ? videos.length : 0;
      const videoData = await searchVideosByKeyword(keyword, 12);
      
      if (append) {
        // 중복 제거: 기존 비디오 ID와 새로운 비디오 ID를 비교
        const existingIds = new Set(videos.map(v => v.id));
        const newVideos = videoData.filter(video => !existingIds.has(video.id));
        setVideos(prev => [...prev, ...newVideos]);
        
        // 새로운 비디오가 너무 적으면 더 이상 로드할 것이 없다고 간주
        if (newVideos.length < 6) {
          setHasMore(false);
        }
      } else {
        setVideos(videoData);
      }
      
      // 더 적은 결과가 반환되면 더 이상 로드할 것이 없다고 간주
      if (!append && videoData.length < 12) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('동영상 검색 실패:', err);
      setError('동영상을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setVideosLoading(false);
      setLoadingMore(false);
    }
  };

  // 더 많은 동영상 로드
  const loadMoreVideos = useCallback(() => {
    if (selectedKeyword && !loadingMore && hasMore) {
      searchVideosForKeyword(selectedKeyword, true);
    }
  }, [selectedKeyword, loadingMore, hasMore, videos.length]);

  // 스크롤 이벤트 핸들러
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || loadingMore || !hasMore) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    // 하단에서 200px 전에 도달하면 더 로드
    if (scrollHeight - scrollTop <= clientHeight + 200) {
      loadMoreVideos();
    }
  }, [loadMoreVideos, loadingMore, hasMore]);

  // 스크롤 이벤트 리스너 등록
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // 태그 선택 핸들러
  const handleKeywordSelect = (keyword: string) => {
    if (selectedKeyword === keyword) return; // 이미 선택된 키워드면 무시
    
    setSelectedKeyword(keyword);
    setVideos([]); // 기존 리스트 초기화
    setHasMore(true);
    setSelectedVideo(null); // 선택된 비디오 초기화
    searchVideosForKeyword(keyword);
  };

  // 비디오 클릭 핸들러 (두 번 클릭 시스템)
  const handleVideoClick = (video: VideoItem) => {
    if (selectedVideo?.id === video.id) {
      // 두 번째 클릭: 전체화면 모달 열기
      setShowFullscreen(true);
    } else {
      // 첫 번째 클릭: 비디오 선택
      setSelectedVideo(video);
    }
  };

  // 요약 버튼 클릭 핸들러
  const handleSummarizeClick = () => {
    if (selectedVideo) {
      const videoUrl = `https://www.youtube.com/watch?v=${selectedVideo.id}`;
      // 기존 요약 워크플로우와 연동
      window.postMessage({
        type: 'FILL_YOUTUBE_URL',
        url: videoUrl
      }, '*');
      
      // 선택 해제
      setSelectedVideo(null);
    }
  };

  // 전체화면 모달 닫기
  const handleCloseFullscreen = () => {
    setShowFullscreen(false);
  };

  // 컴포넌트 마운트 시 키워드 로드
  useEffect(() => {
    fetchUserKeywords();
  }, [user.id]);

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
          <Button onClick={fetchUserKeywords} variant="outline">
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
            아직 충분한 시청 기록이 없습니다. 더 많은 동영상을 요약해보세요!
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
          시청 기록 분석을 통해 발견된 관심 키워드입니다
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
          {[...Array(12)].map((_, i) => (
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
                className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer group ${
                  selectedVideo?.id === video.id ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
                onClick={() => handleVideoClick(video)}
              >
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(video.duration)}
                  </div>
                  {selectedVideo?.id === video.id && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium">
                      선택됨
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="font-medium text-sm mb-1 overflow-hidden" title={video.title} style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    textOverflow: 'ellipsis'
                  }}>
                    {video.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-1 overflow-hidden whitespace-nowrap text-ellipsis" title={video.channelTitle}>
                    {video.channelTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeDate(video.publishedAt)}
                  </p>
                </CardContent>
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
      
      {/* 플로팅 요약 버튼 */}
      {selectedVideo && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={handleSummarizeClick}
            size="lg"
            className="rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            요약하기
          </Button>
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