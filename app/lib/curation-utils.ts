/**
 * 큐레이션 관련 유틸리티 함수들
 */

// 사용자 요약 데이터 타입
export interface UserSummary {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  created_at: string;
}

/**
 * 사용자의 요약 히스토리에서 키워드를 추출하는 함수
 * @param summaries 사용자의 요약 목록
 * @returns 추출된 키워드 배열
 */
export function extractKeywordsFromHistory(summaries: UserSummary[]): string[] {
  if (!summaries || summaries.length === 0) {
    return [];
  }

  // 비디오 제목들을 모두 합쳐서 분석
  const allTitles = summaries.map(s => s.title).join(' ');
  
  // 한국어와 영어 키워드 추출을 위한 정규식
  const koreanWords = allTitles.match(/[가-힣]{2,}/g) || [];
  const englishWords = allTitles.match(/[a-zA-Z]{3,}/g) || [];
  
  // 불용어 제거 (한국어)
  const koreanStopWords = new Set([
    '그리고', '하지만', '그러나', '또한', '따라서', '그래서', '그런데', '하나의', '이것을', '그것을',
    '무엇인가', '어떻게', '왜냐하면', '비디오', '영상', '동영상', '채널', '구독', '좋아요', '댓글',
    '시청', '리뷰', '분석', '설명', '소개', '방법', '하는', '있는', '되는', '하기', '되기', '위한'
  ]);
  
  // 불용어 제거 (영어)
  const englishStopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'why',
    'video', 'tutorial', 'review', 'guide', 'tips', 'channel', 'subscribe', 'like', 'comment', 'watch'
  ]);

  // 키워드 빈도 계산
  const keywordCount = new Map<string, number>();
  
  koreanWords.forEach(word => {
    const lowerWord = word.toLowerCase();
    if (!koreanStopWords.has(lowerWord) && word.length >= 2) {
      keywordCount.set(word, (keywordCount.get(word) || 0) + 1);
    }
  });
  
  englishWords.forEach(word => {
    const lowerWord = word.toLowerCase();
    if (!englishStopWords.has(lowerWord) && word.length >= 3) {
      keywordCount.set(word, (keywordCount.get(word) || 0) + 1);
    }
  });

  // 빈도 순으로 정렬하여 상위 키워드들 반환
  const sortedKeywords = Array.from(keywordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // 상위 10개 키워드만
    .map(([keyword]) => keyword);

  console.log(`[extractKeywordsFromHistory] 추출된 키워드들:`, sortedKeywords);
  
  return sortedKeywords;
}

/**
 * 키워드 배열을 YouTube 검색 쿼리로 변환하는 함수
 * @param keywords 키워드 배열
 * @returns 검색 쿼리 문자열
 */
export function createSearchQueryFromKeywords(keywords: string[]): string {
  if (!keywords || keywords.length === 0) {
    return '';
  }
  
  // 상위 3-4개 키워드를 조합하여 검색 쿼리 만들기
  const topKeywords = keywords.slice(0, Math.min(4, keywords.length));
  
  // OR 연산자로 키워드들을 연결
  const query = topKeywords.join(' OR ');
  
  console.log(`[createSearchQueryFromKeywords] 생성된 검색 쿼리: "${query}"`);
  
  return query;
}

/**
 * 채널명 기반으로 선호도를 분석하는 함수
 * @param summaries 사용자의 요약 목록
 * @returns 인기 채널명 배열
 */
export function extractPopularChannels(summaries: UserSummary[]): string[] {
  if (!summaries || summaries.length === 0) {
    return [];
  }

  const channelCount = new Map<string, number>();
  
  summaries.forEach(summary => {
    if (summary.channel_title && summary.channel_title.trim()) {
      const channel = summary.channel_title.trim();
      channelCount.set(channel, (channelCount.get(channel) || 0) + 1);
    }
  });

  // 2회 이상 등장한 채널만 선별하여 빈도순 정렬
  const popularChannels = Array.from(channelCount.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) // 상위 5개 채널
    .map(([channel]) => channel);

  console.log(`[extractPopularChannels] 인기 채널들:`, popularChannels);
  
  return popularChannels;
}

/**
 * 사용자 선호도를 종합하여 최적의 검색 쿼리를 생성하는 함수
 * @param summaries 사용자의 요약 목록
 * @returns 큐레이션용 검색 쿼리
 */
export function generateCurationQuery(summaries: UserSummary[]): string {
  const keywords = extractKeywordsFromHistory(summaries);
  const popularChannels = extractPopularChannels(summaries);
  
  if (keywords.length === 0 && popularChannels.length === 0) {
    // 기본 인기 콘텐츠 키워드 반환
    return '인기 유튜브 OR 트렌드 OR 추천';
  }
  
  // 키워드를 우선으로 하되, 인기 채널도 일부 포함
  let query = createSearchQueryFromKeywords(keywords);
  
  if (popularChannels.length > 0 && keywords.length < 3) {
    // 키워드가 부족한 경우 채널명 기반 검색도 추가
    const channelQuery = popularChannels.slice(0, 2).join(' OR ');
    query = query ? `${query} OR ${channelQuery}` : channelQuery;
  }
  
  console.log(`[generateCurationQuery] 최종 큐레이션 쿼리: "${query}"`);
  
  return query;
}