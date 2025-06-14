/**
 * 유튜브 비디오 메타데이터에서 키워드와 주제를 추출하는 유틸리티 함수들
 */

/**
 * 유튜브 비디오의 제목, 설명, 태그에서 키워드를 추출하는 함수
 * @param title 비디오 제목
 * @param description 비디오 설명
 * @param tags 비디오 태그 배열
 * @returns 추출된 키워드 배열
 */
export function extractVideoKeywords(
  title: string = '', 
  description: string = '', 
  tags: string[] = []
): string[] {
  const keywords = new Set<string>();
  
  // 태그에서 키워드 추출 (우선순위가 높음)
  tags.forEach(tag => {
    if (tag && tag.length >= 2) {
      keywords.add(tag.toLowerCase().trim());
    }
  });
  
  // 제목에서 키워드 추출
  const titleKeywords = extractTextKeywords(title);
  titleKeywords.forEach(keyword => keywords.add(keyword));
  
  // 설명에서 키워드 추출 (첫 500자만 사용)
  const descriptionText = description.substring(0, 500);
  const descKeywords = extractTextKeywords(descriptionText);
  descKeywords.slice(0, 10).forEach(keyword => keywords.add(keyword)); // 설명에서는 상위 10개만
  
  return Array.from(keywords).slice(0, 20); // 최대 20개 키워드
}

/**
 * 유튜브 비디오의 제목, 설명, 태그에서 주제를 추론하는 함수
 * @param title 비디오 제목
 * @param description 비디오 설명
 * @param tags 비디오 태그 배열
 * @returns 추출된 주제 배열
 */
export function extractVideoTopics(
  title: string = '', 
  description: string = '', 
  tags: string[] = []
): string[] {
  const topics = new Set<string>();
  
  // 주제 관련 패턴 매칭
  const topicPatterns = {
    '기술': ['tech', 'technology', '기술', '개발', 'development', 'programming', '프로그래밍', 'ai', 'artificial intelligence'],
    '요리': ['recipe', 'cooking', '요리', '음식', 'food', '레시피', '맛집'],
    '여행': ['travel', '여행', 'trip', '관광', 'tourism', '휴가', 'vacation'],
    '교육': ['education', '교육', 'learning', '학습', 'tutorial', '튜토리얼', '강의', 'lecture'],
    '게임': ['game', '게임', 'gaming', 'play', '플레이'],
    '음악': ['music', '음악', 'song', '노래', 'musician', '가수', 'artist'],
    '스포츠': ['sport', '스포츠', 'football', '축구', 'baseball', '야구', '운동', 'exercise'],
    '뷰티': ['beauty', '뷰티', 'makeup', '메이크업', 'cosmetic', '화장품', '패션', 'fashion'],
    '건강': ['health', '건강', 'fitness', '운동', 'diet', '다이어트', '의학', 'medical'],
    '엔터테인먼트': ['entertainment', '엔터테인먼트', 'movie', '영화', 'drama', '드라마', 'tv', '방송'],
    '비즈니스': ['business', '비즈니스', 'entrepreneur', '창업', 'startup', '경영', 'management'],
    '라이프스타일': ['lifestyle', '라이프스타일', 'daily', '일상', 'vlog', '브이로그']
  };
  
  const allText = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
  
  // 각 주제에 대해 키워드 매칭
  Object.entries(topicPatterns).forEach(([topic, patterns]) => {
    const matches = patterns.filter(pattern => allText.includes(pattern.toLowerCase()));
    if (matches.length > 0) {
      topics.add(topic);
    }
  });
  
  // 기본 주제가 없다면 제목에서 추론
  if (topics.size === 0) {
    const titleWords = extractTextKeywords(title);
    if (titleWords.length > 0) {
      topics.add('일반'); // 기본 주제
    }
  }
  
  return Array.from(topics).slice(0, 5); // 최대 5개 주제
}

/**
 * 텍스트에서 키워드를 추출하는 내부 함수
 * @param text 분석할 텍스트
 * @returns 추출된 키워드 배열
 */
function extractTextKeywords(text: string): string[] {
  if (!text) return [];
  
  // 한글과 영어 단어 추출
  const koreanWords = text.match(/[가-힣]{2,}/g) || [];
  const englishWords = text.match(/[a-zA-Z]{3,}/g) || [];
  
  // 불용어 제거
  const stopWords = new Set([
    // 한국어 불용어
    '그리고', '하지만', '그러나', '또한', '따라서', '그래서', '그런데', '하나의', '이것을', '그것을',
    '무엇인가', '어떻게', '왜냐하면', '비디오', '영상', '동영상', '채널', '구독', '좋아요', '댓글',
    '시청', '리뷰', '분석', '설명', '소개', '방법', '하는', '있는', '되는', '하기', '되기', '위한',
    '이번', '오늘', '내일', '어제', '지금', '그때', '언제', '어디서', '누구', '무엇', '어떤',
    // 영어 불용어
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'why',
    'video', 'tutorial', 'review', 'guide', 'tips', 'channel', 'subscribe', 'like', 'comment', 'watch',
    'this', 'that', 'these', 'those', 'when', 'where', 'who', 'which', 'will', 'would', 'could', 'should'
  ]);
  
  const allWords = [...koreanWords, ...englishWords.map(w => w.toLowerCase())];
  const filteredWords = allWords.filter(word => 
    !stopWords.has(word.toLowerCase()) && 
    word.length >= 2
  );
  
  // 빈도 계산
  const wordCount = new Map<string, number>();
  filteredWords.forEach(word => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });
  
  // 빈도 순으로 정렬
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 15); // 상위 15개
}