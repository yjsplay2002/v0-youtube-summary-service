'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-context';
import { getUserKeywords, searchVideosByKeyword } from '@/app/actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Clock, User, Sparkles, Tag } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);

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
  const searchVideosForKeyword = async (keyword: string) => {
    try {
      setVideosLoading(true);
      setError(null);
      
      const videoData = await searchVideosByKeyword(keyword, 10);
      setVideos(videoData);
    } catch (err) {
      console.error('동영상 검색 실패:', err);
      setError('동영상을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setVideosLoading(false);
    }
  };

  // 태그 선택 핸들러
  const handleKeywordSelect = (keyword: string) => {
    if (selectedKeyword === keyword) return; // 이미 선택된 키워드면 무시
    
    setSelectedKeyword(keyword);
    setVideos([]); // 기존 리스트 초기화
    searchVideosForKeyword(keyword);
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

      {/* 동영상 리스트 */}
      {videosLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(10)].map((_, i) => (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <Card key={video.id} className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
              <div className="relative aspect-video overflow-hidden">
                <YouTube
                  videoId={video.id}
                  className="w-full h-full"
                  opts={{
                    width: '100%',
                    height: '100%',
                    playerVars: {
                      autoplay: 0,
                      controls: 1,
                      rel: 0,
                      showinfo: 0,
                      modestbranding: 1,
                    },
                  }}
                />
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  {formatDuration(video.duration)}
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                  {video.title}
                </h3>
                <div className="flex items-center text-xs text-muted-foreground mb-1">
                  <User className="w-3 h-3 mr-1" />
                  <span className="truncate">{video.channelTitle}</span>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>{formatRelativeDate(video.publishedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
}