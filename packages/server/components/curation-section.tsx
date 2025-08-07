'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth-context';
import { useSearchParams } from 'next/navigation';
import { getUserKeywords, searchVideosByKeyword, checkVideoSummaryExists, checkMultipleVideoSummaryExists, getTrendingVideos, getRelatedVideos } from '@/app/actions';
import { isUserAdmin } from '@/app/lib/auth-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Clock, User, Sparkles, Tag, X, Eye, FileText, TrendingUp, Zap } from 'lucide-react';
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
  viewCount?: string;
  category?: string;
}

interface UserKeyword {
  keyword: string;
  frequency: number;
}

interface CurationSectionProps {
  className?: string;
  currentVideoId?: string;
}

// 유틸리티 함수들
function formatDuration(duration: string): string {
  if (!duration || duration === 'Unknown') return '';
  
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

function formatViewCount(viewCount: string): string {
  const count = parseInt(viewCount);
  if (count >= 100000000) return `${Math.floor(count / 100000000)}억`;
  if (count >= 10000) return `${Math.floor(count / 10000)}만`;
  if (count >= 1000) return `${Math.floor(count / 1000)}천`;
  return count.toString();
}

export default function CurationSection({ className, currentVideoId }: CurationSectionProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  
  // 상태
  const [mode, setMode] = useState<'trending' | 'related' | 'interest'>('trending');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [keywords, setKeywords] = useState<UserKeyword[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [videoSummaryStatus, setVideoSummaryStatus] = useState<{[videoId: string]: boolean}>({});
  
  // 중복 로딩 방지를 위한 ref
  const loadingRef = useRef(false);
  const lastLoadedKey = useRef<string>('');

  // videoId 결정
  const videoId = searchParams.get('videoId') || currentVideoId;

  // 모드 결정 함수
  const determineMode = (): 'trending' | 'related' | 'interest' => {
    if (!user) return 'trending';
    if (videoId && isUserAdmin(user)) return 'related';
    return 'interest';
  };

  // 비디오 요약 상태 확인 (배치 처리)
  const checkSummaryStatus = async (videoIds: string[]) => {
    if (!videoIds.length) return;
    
    const statusMap = await checkMultipleVideoSummaryExists(videoIds, user?.id);
    setVideoSummaryStatus(prev => ({ ...prev, ...statusMap }));
  };

  // 데이터 로딩 함수
  const loadData = async () => {
    const currentMode = determineMode();
    const loadKey = `${currentMode}-${videoId}-${user?.id}`;
    
    // 중복 로딩 방지
    if (loadingRef.current || lastLoadedKey.current === loadKey) {
      return;
    }
    
    loadingRef.current = true;
    lastLoadedKey.current = loadKey;
    setLoading(true);
    setError(null);
    setMode(currentMode);
    
    try {
      let result: { videos: VideoItem[] } = { videos: [] };
      
      switch (currentMode) {
        case 'trending':
          result = await getTrendingVideos(12);
          setKeywords([]);
          setSelectedKeyword(null);
          break;
          
        case 'related':
          if (videoId) {
            result = await getRelatedVideos(videoId, 12, user?.email);
          }
          setKeywords([]);
          setSelectedKeyword(null);
          break;
          
        case 'interest':
          if (user?.id) {
            const keywordData = await getUserKeywords(user.id);
            setKeywords(keywordData || []);
            
            if (keywordData && keywordData.length > 0) {
              const topKeyword = keywordData[0].keyword;
              setSelectedKeyword(topKeyword);
              const searchResult = await searchVideosByKeyword(topKeyword, 12);
              result = searchResult;
            }
          }
          break;
      }
      
      setVideos(result.videos);
      
      if (result.videos.length > 0) {
        await checkSummaryStatus(result.videos.map(v => v.id));
      }
    } catch (err) {
      console.error('데이터 로딩 실패:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // 키워드 선택 핸들러
  const handleKeywordSelect = async (keyword: string) => {
    if (selectedKeyword === keyword || loadingRef.current) return;
    
    loadingRef.current = true;
    setSelectedKeyword(keyword);
    setLoading(true);
    
    try {
      const searchResult = await searchVideosByKeyword(keyword, 12);
      setVideos(searchResult.videos);
      
      if (searchResult.videos.length > 0) {
        await checkSummaryStatus(searchResult.videos.map(v => v.id));
      }
    } catch (err) {
      console.error('키워드 검색 실패:', err);
      setError('키워드 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // 비디오 클릭 핸들러 (전체화면 모달)
  const handleVideoClick = (video: VideoItem) => {
    setSelectedVideo(video);
    setShowFullscreen(true);
  };

  // 비디오 재생 핸들러 (페이지 이동 후 자동 재생)
  const handleVideoPlay = (video: VideoItem) => {
    const videoId = video.id;
    // videoId 페이지로 이동하고 자동재생 파라미터 추가
    window.location.href = `/?videoId=${videoId}&autoplay=true`;
  };

  // 요약 버튼 클릭 핸들러
  const handleSummarizeClick = async () => {
    if (!selectedVideo) return;
    
    const videoId = selectedVideo.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    if (videoSummaryStatus[videoId]) {
      window.location.href = `/?videoId=${videoId}`;
      return;
    }
    
    window.postMessage({
      type: 'FILL_YOUTUBE_URL',
      url: videoUrl
    }, '*');
    
    const youtubeFormSection = document.getElementById('youtube-form');
    if (youtubeFormSection) {
      youtubeFormSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    toast.success('동영상이 설정되었습니다', {
      description: '아래 요약 폼에서 요약을 시작하세요.',
      duration: 3000,
    });
  };

  // 키보드 이벤트 핸들러
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showFullscreen) {
        setShowFullscreen(false);
      }
    };

    if (showFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showFullscreen]);

  // 데이터 로딩 useEffect - 단순화
  useEffect(() => {
    loadData();
  }, [user?.id, videoId]); // 핵심 의존성만

  // 제목과 설명
  const getTitleAndDescription = () => {
    // 비디오가 있지만 관리자가 아닌 경우 관련 영상 대신 맞춤 추천을 표시
    if (videoId && !isUserAdmin(user) && mode === 'interest') {
      return {
        title: '맞춤 추천',
        description: '시청 기록 분석을 통해 발견된 관심 키워드 기반 추천 (관련 영상 기능은 관리자 전용)',
        icon: <Zap className="w-5 h-5" />
      };
    }
    
    switch (mode) {
      case 'trending':
        return {
          title: '실시간 급등 영상',
          description: '정보전달 위주의 인기 급상승 동영상들을 확인해보세요',
          icon: <TrendingUp className="w-5 h-5" />
        };
      case 'related':
        return {
          title: '관련 영상 (관리자 전용)',
          description: '현재 보고 있는 영상과 관련된 추천 동영상들입니다',
          icon: <Sparkles className="w-5 h-5" />
        };
      case 'interest':
        return {
          title: '맞춤 추천',
          description: '시청 기록 분석을 통해 발견된 관심 키워드 기반 추천',
          icon: <Zap className="w-5 h-5" />
        };
      default:
        return {
          title: '큐레이션',
          description: '추천 동영상',
          icon: <Tag className="w-5 h-5" />
        };
    }
  };

  const { title, description, icon } = getTitleAndDescription();

  if (error) {
    return (
      <div className={className}>
        <div className="text-center py-8">
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => loadData()} variant="outline">
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>
      
      {/* 키워드 태그들 - 관심사 모드일 때만 표시 */}
      {mode === 'interest' && keywords.length > 0 && (
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
      )}

      {/* 선택된 키워드 표시 */}
      {mode === 'interest' && selectedKeyword && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-primary">
            "{selectedKeyword}" 관련 동영상
          </h3>
        </div>
      )}

      {/* 동영상 리스트 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
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
      ) : videos.length > 0 ? (
        <div className="max-h-[80vh] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
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
                        event.target.pauseVideo();
                      } catch (error) {
                        console.debug('YouTube player ready - CORS error ignored:', error);
                      }
                    }}
                    onError={(error) => {
                      console.debug('YouTube player error ignored:', error);
                    }}
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-300" />
                  <div 
                    className="absolute inset-0 flex items-center justify-center cursor-pointer z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVideoPlay(video);
                    }}
                  >
                    <PlayCircle className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(video.duration)}
                  </div>
                  
                  {/* 급등 영상 모드일 때 조회수 표시 */}
                  {mode === 'trending' && video.viewCount && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {formatViewCount(video.viewCount)}
                    </div>
                  )}
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm line-clamp-2 mb-2">
                    {video.title}
                  </h3>
                  <div className="flex items-center text-xs text-muted-foreground mb-2">
                    <User className="w-3 h-3 mr-1" />
                    <span className="truncate">{video.channelTitle}</span>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    <span>{formatRelativeDate(video.publishedAt)}</span>
                  </div>
                </CardContent>
                
                {/* 플로팅 요약 버튼 */}
                <div 
                  className="absolute bottom-3 right-3 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
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
        </div>
      ) : (
        <div className="text-center py-8">
          <PlayCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {mode === 'trending' && '급등 영상을 찾을 수 없습니다.'}
            {mode === 'related' && '관련 영상을 찾을 수 없습니다.'}
            {mode === 'interest' && selectedKeyword && `"${selectedKeyword}" 관련 동영상을 찾을 수 없습니다.`}
            {mode === 'interest' && !selectedKeyword && '관심 있는 키워드를 선택해보세요!'}
          </p>
        </div>
      )}

      {/* 전체화면 비디오 모달 */}
      {showFullscreen && selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="relative w-full max-w-6xl aspect-video bg-black rounded-lg overflow-hidden">
            <Button
              onClick={() => setShowFullscreen(false)}
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