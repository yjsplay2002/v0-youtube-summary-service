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
      console.error('[fetchTranscript] No datasetId returned from Apify actor run');
      return null;
    }
    
    // 데이터셋에서 결과 가져오기
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    
    if (!items || items.length === 0 || !items[0]) {
      console.error('[fetchTranscript] No transcript items returned from Apify dataset');
      return null;
    }
    
    // Apify 액터의 결과에서 받은 JSON 데이터 전체를 그대로 반환
    const rawData = items[0];

    if (!rawData) {
      console.error('[fetchTranscript] No data returned from Apify result');
      return null;
    }
    
    console.log(`[fetchTranscript] Successfully fetched data using Apify:`, rawData);
    return rawData;
  } catch (error) {
    console.error('[fetchTranscript] Error fetching transcript with Apify:', error);
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
