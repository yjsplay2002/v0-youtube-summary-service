/**
 * Web search utilities for enhanced context when RAG fails
 */

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  query: string;
  resultCount: number;
  searchTime: number;
}

/**
 * Search the web for additional context using SerpAPI or similar
 * For now, we'll use a simple implementation that could be extended
 */
export async function searchWeb(query: string, options: {
  maxResults?: number;
  safeSearch?: boolean;
  language?: string;
} = {}): Promise<WebSearchResponse> {
  const {
    maxResults = 5,
    safeSearch = true,
    language = 'ko'
  } = options;

  console.log(`[WebSearch] Searching for: "${query}"`);
  console.log(`[WebSearch] Options:`, { maxResults, safeSearch, language });

  const startTime = Date.now();

  try {
    // For now, we'll create a mock implementation
    // In a real implementation, you would use:
    // - SerpAPI (https://serpapi.com/)
    // - Google Custom Search API
    // - Bing Search API
    // - DuckDuckGo API
    
    const mockResults: WebSearchResult[] = [
      {
        title: `${query}에 대한 최신 정보`,
        url: "https://example.com/search-result-1",
        snippet: `${query}와 관련된 최신 동향과 정보를 제공합니다. 이 분야의 전문가들이 공유하는 인사이트와 실무 경험을 확인하세요.`,
        source: "웹 검색 결과"
      },
      {
        title: `${query} 가이드 및 팁`,
        url: "https://example.com/search-result-2", 
        snippet: `${query}에 대한 실용적인 가이드와 전문가 팁을 제공합니다. 단계별 설명과 실제 사례를 통해 더 깊이 이해할 수 있습니다.`,
        source: "웹 검색 결과"
      }
    ];

    const searchTime = Date.now() - startTime;
    
    console.log(`[WebSearch] Found ${mockResults.length} results in ${searchTime}ms`);
    
    return {
      results: mockResults.slice(0, maxResults),
      query,
      resultCount: mockResults.length,
      searchTime
    };
    
  } catch (error) {
    console.error('[WebSearch] Error during web search:', error);
    
    const searchTime = Date.now() - startTime;
    
    return {
      results: [],
      query,
      resultCount: 0,
      searchTime
    };
  }
}

/**
 * Format web search results into a context string
 */
export function formatWebSearchContext(searchResults: WebSearchResponse): string {
  if (searchResults.results.length === 0) {
    return '';
  }

  const contextParts = searchResults.results.map((result, index) => {
    return `${index + 1}. **${result.title}**\n   ${result.snippet}\n   출처: ${result.source}`;
  });

  return `웹 검색 결과 (${searchResults.resultCount}개):\n\n${contextParts.join('\n\n')}`;
}

/**
 * Extract key terms from a query for better web search
 */
export function extractSearchTerms(query: string, videoTitle?: string): string {
  // Remove common Korean question words and particles
  const cleanedQuery = query
    .replace(/[은는이가를에서와과]/g, ' ')
    .replace(/\b(무엇|어떻게|왜|언제|어디|누가|어떤|뭐|뭔|그것|그|저|이)\b/g, ' ')
    .replace(/\b(인가요|인지|일까요|까요|어요|해요|습니다|입니다)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Combine with video title context if available
  if (videoTitle) {
    const titleKeywords = videoTitle
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(' ')
      .filter(word => word.length > 1)
      .slice(0, 3)
      .join(' ');
    
    return `${cleanedQuery} ${titleKeywords}`.trim();
  }

  return cleanedQuery;
}

/**
 * Determine if web search should be used based on query characteristics
 */
export function shouldUseWebSearch(query: string): boolean {
  // Use web search for queries that might benefit from current information
  const webSearchTriggers = [
    '최신', '신규', '새로운', '현재', '지금', '오늘', '요즘', 
    '트렌드', '동향', '소식', '뉴스', '업데이트',
    '비교', '차이', '대안', '추천', '순위',
    '가격', '비용', '요금', '무료', '유료'
  ];

  return webSearchTriggers.some(trigger => query.includes(trigger));
}