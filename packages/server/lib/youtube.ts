// app/lib/youtube.ts

/**
 * 유튜브 관련 함수 모음 (ID 추출, 상세정보, 자막 등)
 */

import { ApifyClient } from 'apify-client';

/**
 * 유튜브 URL에서 비디오 ID를 추출하는 함수
 * @param url 유튜브 URL
 * @returns 비디오 ID 또는 null
 */
export function extractVideoId(url: string): string | null {
  console.log(`[extractVideoId] 입력 URL: ${url}`);
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  if (!match || !match[7] || match[7].length !== 11) {
    console.warn(`[extractVideoId] 올바르지 않은 유튜브 URL이거나 videoId 추출 실패: ${url}`);
    return null;
  }
  const videoId = match[7];
  console.log(`[extractVideoId] 추출된 videoId: ${videoId}`);
  return videoId;
}

/**
 * 유튜브 자막을 가져오는 함수 (Apify 사용)
 * @param videoId 유튜브 비디오 ID
 * @returns Apify에서 받은 원본 JSON 데이터 또는 null
 */
export async function fetchTranscript(videoId: string): Promise<any | null> {
  const startTime = Date.now();
  console.log(`[fetchTranscript] Fetching transcript for video: ${videoId} using Apify`);
  
  try {
    const apifyApiToken = process.env.APIFY_API_TOKEN;
    if (!apifyApiToken) {
      console.error('[fetchTranscript] APIFY_API_TOKEN is not set in environment');
      return null;
    }
    
    const client = new ApifyClient({ token: apifyApiToken });
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const input = {
      startUrls: [youtubeUrl],
      language: 'Default',
      includeTimestamps: 'Yes',
    };
    
    // Apify 액터 실행
    const run = await client.actor('dB9f4B02ocpTICIEY').call(input);
    
    if (!run?.defaultDatasetId) {
      const duration = Date.now() - startTime;
      console.error(`[fetchTranscript] Failed: No datasetId returned from Apify actor run (${duration}ms)`);
      return null;
    }
    
    // 데이터셋에서 결과 가져오기
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    if (!items || items.length === 0 || !items[0]) {
      const duration = Date.now() - startTime;
      console.error(`[fetchTranscript] Failed: No transcript items returned from Apify dataset (${duration}ms)`);
      return null;
    }
    
    // Apify 액터의 결과에서 받은 JSON 데이터 전체를 그대로 반환
    const rawData = items[0];

    if (!rawData) {
      const duration = Date.now() - startTime;
      console.error(`[fetchTranscript] Failed: No data returned from Apify result (${duration}ms)`);
      return null;
    }
    
    const duration = Date.now() - startTime;
    const dataSize = JSON.stringify(rawData).length;
    console.log(`[fetchTranscript] Success: Fetched transcript data (${dataSize} chars) in ${duration}ms`);
    
    return rawData;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[fetchTranscript] Failed: Error fetching transcript with Apify (${duration}ms):`, error);
    return null;
  }
}

/**
 * Apify Transcript 구조 타입 정의
 */
export interface ApifyTranscriptData {
  videoTitle: string;
  url: string;
  channelName: string;
  views: string;
  videoPostDate: string;
  channelSubscription: string;
  transcript: Array<{
    text: string;
    timestamp: string;
  }>;
}

/**
 * YouTube 영상 정보 반환 타입 정의
 */
export interface VideoDetails {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      channelTitle: string;
      description: string;
      publishedAt: string;
      tags?: string[];
      thumbnails: {
        default: { url: string; width: number; height: number };
        medium: { url: string; width: number; height: number };
        high: { url: string; width: number; height: number };
      };
    };
    contentDetails: {
      duration: string;
    };
  }>;
  [key: string]: any; // 기타 속성을 위한 인덱스 시그니처
}

/**
 * YouTube 비디오 목록 아이템 타입 정의 (큐레이션용)
 */
export interface VideoListItem {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  description?: string;
}

/**
 * YouTube 검색/트렌딩 결과 타입 정의
 */
export interface YoutubeSearchResult {
  items: VideoListItem[];
  nextPageToken?: string;
  totalResults?: number;
}


/**
 * YouTube 영상 정보를 가져오는 함수
 * @param videoId 유튜브 비디오 ID
 * @returns 비디오 상세 정보
 * @throws {Error} API 키가 없거나 비디오를 찾을 수 없는 경우
 */
export async function getVideoDetails(videoId: string): Promise<VideoDetails> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[getVideoDetails] YOUTUBE_API_KEY is missing');
    throw new Error('YouTube API 키가 설정되지 않았습니다.');
  }

  console.log(`[getVideoDetails] Fetching details for video: ${videoId}`);
  const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[getVideoDetails] YouTube API error: ${response.status}`, errorData);
      throw new Error(`YouTube API responded with status ${response.status}`);
    }
    const details = await response.json();

    if (!details?.items?.length) {
      console.error(`[getVideoDetails] No video found with ID: ${videoId}`);
      throw new Error('지정된 ID의 비디오를 찾을 수 없습니다.');
    }
    
    console.log(`[getVideoDetails] Successfully fetched details for video: ${videoId}`);
    return details as VideoDetails;
  } catch (error) {
    console.error(`[getVideoDetails] Error fetching video details:`, error);
    // Rethrow the error to be handled by the caller
    throw error;
  }
}

/**
 * YouTube 트렌딩 비디오를 가져오는 함수
 * @param maxResults 가져올 비디오 수 (기본값: 12)
 * @param pageToken 페이지네이션 토큰
 * @returns 트렌딩 비디오 목록
 */
export async function getTrendingVideos(maxResults: number = 12, pageToken?: string): Promise<YoutubeSearchResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[getTrendingVideos] YOUTUBE_API_KEY is missing');
    throw new Error('YouTube API 키가 설정되지 않았습니다.');
  }

  console.log(`[getTrendingVideos] Fetching trending videos (maxResults: ${maxResults})`);
  
  let url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&chart=mostPopular&maxResults=${maxResults}&key=${apiKey}&regionCode=KR`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[getTrendingVideos] YouTube API error: ${response.status}`, errorData);
      throw new Error(`YouTube API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    
    const items: VideoListItem[] = data.items?.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      publishedAt: item.snippet.publishedAt,
      duration: item.contentDetails.duration,
      description: item.snippet.description
    })) || [];
    
    console.log(`[getTrendingVideos] Successfully fetched ${items.length} trending videos`);
    
    return {
      items,
      nextPageToken: data.nextPageToken,
      totalResults: data.pageInfo?.totalResults
    };
  } catch (error) {
    console.error(`[getTrendingVideos] Error fetching trending videos:`, error);
    throw error;
  }
}

/**
 * YouTube에서 키워드로 비디오를 검색하는 함수
 * @param query 검색 키워드
 * @param maxResults 가져올 비디오 수 (기본값: 12)
 * @param pageToken 페이지네이션 토큰
 * @returns 검색된 비디오 목록
 */
export async function searchVideos(query: string, maxResults: number = 12, pageToken?: string): Promise<YoutubeSearchResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[searchVideos] YOUTUBE_API_KEY is missing');
    throw new Error('YouTube API 키가 설정되지 않았습니다.');
  }

  console.log(`[searchVideos] Searching videos with query: "${query}" (maxResults: ${maxResults})`);
  
  let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(query)}&key=${apiKey}&regionCode=KR&order=relevance`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`[searchVideos] YouTube API error: ${response.status}`, errorData);
      throw new Error(`YouTube API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // 검색 결과에서 비디오 ID들을 추출하여 상세 정보를 가져옴
    const videoIds = data.items?.map((item: any) => item.id.videoId).filter(Boolean) || [];
    
    if (videoIds.length === 0) {
      return { items: [] };
    }
    
    // 비디오 상세 정보를 가져와서 duration 포함
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoIds.join(',')}&key=${apiKey}`;
    const detailsResponse = await fetch(detailsUrl);
    
    if (!detailsResponse.ok) {
      console.warn('[searchVideos] Failed to fetch video details, using basic info');
      // 기본 정보만으로 반환
      const items: VideoListItem[] = data.items?.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        publishedAt: item.snippet.publishedAt,
        duration: 'Unknown',
        description: item.snippet.description
      })) || [];
      
      return {
        items,
        nextPageToken: data.nextPageToken,
        totalResults: data.pageInfo?.totalResults
      };
    }
    
    const detailsData = await detailsResponse.json();
    
    const items: VideoListItem[] = detailsData.items?.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      publishedAt: item.snippet.publishedAt,
      duration: item.contentDetails.duration,
      description: item.snippet.description
    })) || [];
    
    console.log(`[searchVideos] Successfully found ${items.length} videos for query: "${query}"`);
    
    return {
      items,
      nextPageToken: data.nextPageToken,
      totalResults: data.pageInfo?.totalResults
    };
  } catch (error) {
    console.error(`[searchVideos] Error searching videos:`, error);
    throw error;
  }
}


/**
 * 비디오의 사용 가능한 자막 언어 목록을 가져오는 함수
 * @param videoId 유튜브 비디오 ID
 * @returns 사용 가능한 언어 코드 배열 또는 null
 */
export async function getAvailableTranscriptLanguages(videoId: string): Promise<string[] | null> {
  console.log(`[getAvailableTranscriptLanguages] Fetching available languages for video: ${videoId}`);
  try {
    // Apify를 사용하여 자막 정보를 가져옴
    const apifyRawData = await fetchTranscript(videoId);
    
    if (!apifyRawData || !apifyRawData.subtitles || !Array.isArray(apifyRawData.subtitles)) {
      console.warn(`[getAvailableTranscriptLanguages] No subtitles metadata found in Apify data for video: ${videoId}`);
      // 자막이 없는 경우에도 'en'을 기본으로 반환하여 영어 요약 시도
      return ['en'];
    }
    
    // 자막 메타데이터에서 언어 코드만 추출
    const languages = apifyRawData.subtitles.map((sub: any) => sub.lang_code).filter(Boolean);
    
    // 'en'이 없는 경우 추가
    if (!languages.includes('en')) {
      languages.push('en');
    }
    
    console.log(`[getAvailableTranscriptLanguages] Found languages: ${[...new Set(languages)].join(', ')}`);
    return [...new Set(languages)];
  } catch (error) {
    console.error(`[getAvailableTranscriptLanguages] Error fetching available languages:`, error);
    return ['en']; // 에러 발생 시 영어 기본값 반환
  }
}
