// app/lib/youtube.ts

/**
 * 유튜브 관련 함수 모음 (ID 추출, 상세정보, 자막 등)
 */

import { YoutubeTranscript } from 'youtube-transcript-plus';
import { fetchTranscriptWithPuppeteer, fetchFullTranscriptWithPuppeteer } from './puppeteer-transcript';

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name: { simpleText: string };
  vssId: string;
  isTranslatable: boolean;
}


// Function to fetch transcript using youtube-transcript-plus
// 자막 항목에 대한 타입 정의
interface TranscriptEntry {
  text: string;
  duration: number;
  offset: number;
  [key: string]: any; // 추가 필드가 있을 수 있음
}

/**
 * 유튜브 자막을 가져오는 함수
 * @param videoId 유튜브 비디오 ID
 * @param languages 시도할 언어 배열 (우선순위대로 시도)
 * @returns 자막 텍스트 또는 null
 */
export async function fetchTranscript(
  videoId: string, 
  languages: string[] = ['ko', 'en']
): Promise<string | null> {
  console.log(`[fetchTranscript] Fetching transcript for video: ${videoId}, languages: ${languages.join(', ')}`);
  
  try {
    // 1. 지정된 언어들을 순서대로 시도
    for (const lang of languages) {
      try {
        console.log(`[fetchTranscript] Trying language: ${lang}`);
        const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        
        if (transcript && transcript.length > 0) {
          const fullText = transcript.map((entry) => entry.text).join(' ');
          console.log(`[fetchTranscript] Successfully fetched ${lang} transcript (${fullText.length} characters)`);
          return fullText;
        }
      } catch (langError) {
        console.log(`[fetchTranscript] ${lang} transcript not available, trying next language...`);
      }
    }
    
    // 2. 언어 지정 없이 자동 생성된 자막 시도
    try {
      console.log('[fetchTranscript] Trying auto-generated transcript');
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (transcript && transcript.length > 0) {
        const fullText = transcript.map((entry) => entry.text).join(' ');
        console.log(`[fetchTranscript] Successfully fetched auto transcript (${fullText.length} characters)`);
        return fullText;
      }
    } catch (autoError) {
      console.log('[fetchTranscript] Auto-generated transcript not available');
    }
    
    // 3. Puppeteer를 사용하여 자막 추출 시도
    console.log('[fetchTranscript] Trying puppeteer method');
    try {
      // 먼저 전체 트랜스크립트 방식 시도
      const fullTranscript = await fetchFullTranscriptWithPuppeteer(videoId);
      if (fullTranscript) {
        console.log(`[fetchTranscript] Successfully fetched transcript using puppeteer (full method) (${fullTranscript.length} characters)`);
        return fullTranscript;
      }
      
      // 실패하면 기본 방식 시도
      const basicTranscript = await fetchTranscriptWithPuppeteer(videoId);
      if (basicTranscript) {
        console.log(`[fetchTranscript] Successfully fetched transcript using puppeteer (basic method) (${basicTranscript.length} characters)`);
        return basicTranscript;
      }
    } catch (puppeteerError) {
      console.error('[fetchTranscript] Puppeteer method failed:', puppeteerError);
    }
    
    // 4. 모든 시도 실패
    console.warn('[fetchTranscript] No transcripts available for this video after multiple attempts');
    return null;
  } catch (error) {
    console.error('[fetchTranscript] Error fetching transcript:', error);
    return null;
  }
}

// Function to extract video ID from YouTube URL
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

// 비디오 상세 정보를 저장할 간단한 메모리 캐시
const videoDetailsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5분 캐시 유지

// Function to fetch video details from YouTube API with caching
export async function getVideoDetails(videoId: string, apiKey: string) {
  console.log(`[getVideoDetails] 요청 videoId: ${videoId}`);
  
  // 캐시에서 확인
  const cached = videoDetailsCache.get(videoId);
  const now = Date.now();
  
  // 캐시가 있고 TTL 내에 있는 경우 캐시된 데이터 반환
  if (cached && now - cached.timestamp < CACHE_TTL) {
    console.log(`[getVideoDetails] 캐시된 비디오 정보 사용: ${videoId}`);
    return { ...cached.data }; // 깊은 복사 반환
  }
  
  // 캐시가 없거나 만료된 경우 API 호출
  const videoUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;
  console.log(`[getVideoDetails] API 요청: ${videoUrl}`);
  
  try {
    const response = await fetch(videoUrl);
    console.log(`[getVideoDetails] 응답 상태: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[getVideoDetails] API 오류: ${errorText}`);
      throw new Error(`YouTube API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      console.error(`[getVideoDetails] 비디오를 찾을 수 없음: ${videoId}`);
      throw new Error('No video found with the specified ID');
    }
    
    console.log(`[getVideoDetails] 성공적으로 비디오 정보 가져옴: ${data.items[0].snippet.title}`);
    
    // 캐시에 저장 (5분 TTL)
    videoDetailsCache.set(videoId, {
      data: { ...data }, // 깊은 복사 저장
      timestamp: now
    });
    
    return data;
  } catch (error) {
    console.error(`[getVideoDetails] 오류 발생:`, error);
    // 캐시가 있고 에러가 발생한 경우 캐시된 데이터 반환 (사용 가능한 경우)
    if (cached) {
      console.log(`[getVideoDetails] 오류 발생으로 캐시된 데이터 반환: ${videoId}`);
      return { ...cached.data }; // 깊은 복사 반환
    }
    throw error; // 캐시도 없는 경우 에러 전파
  }
}

// Function to fetch available caption tracks for a video
export async function getAvailableCaptionTracks(videoId: string, apiKey: string): Promise<CaptionTrack[]> {
  console.log(`[getAvailableCaptionTracks] Fetching captions for video: ${videoId}`);
  
  try {
    // First, get the video details to check if captions are available
    const videoData = await getVideoDetails(videoId, apiKey);
    const videoTitle = videoData.items[0].snippet.title;
    console.log(`[getAvailableCaptionTracks] Video title: ${videoTitle}`);
    
    // Get the video's caption tracks
    const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    console.log(`[getAvailableCaptionTracks] Fetching captions from: ${captionsUrl}`);
    
    const response = await fetch(captionsUrl);
    if (!response.ok) {
      console.error(`[getAvailableCaptionTracks] Failed to fetch captions: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      console.log('[getAvailableCaptionTracks] No captions available for this video');
      return [];
    }
    
    // Format the caption tracks
    const captionTracks = data.items.map((item: any) => ({
      languageCode: item.snippet.language,
      name: { simpleText: item.snippet.name },
      vssId: item.id,
      isTranslatable: item.snippet.trackKind === 'asr'
    }));
    
    console.log(`[getAvailableCaptionTracks] Found ${captionTracks.length} caption tracks`);
    return captionTracks;
  } catch (error) {
    console.error('[getAvailableCaptionTracks] Error:', error);
    return [];
  }
}

// downloadCaptionTrack 함수는 youtube-transcript-plus 라이브러리를 사용하므로 제거되었습니다.

import { ApifyClient } from 'apify-client';

// Function to fetch YouTube transcript using Apify Actor
export async function fetchTranscriptWithApi(videoId: string): Promise<string | null> {
  try {
    const apifyApiToken = process.env.APIFY_API_TOKEN;
    if (!apifyApiToken) {
      console.error('[fetchTranscriptWithApi] APIFY_API_TOKEN is not set in environment');
      return null;
    }
    const client = new ApifyClient({ token: apifyApiToken });
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const input = {
      startUrls: [youtubeUrl],
      language: 'Default',
      includeTimestamps: 'No',
    };
    // Run the Apify actor and wait for it to finish
    const run = await client.actor('dB9f4B02ocpTICIEY').call(input);
    if (!run?.defaultDatasetId) {
      console.error('[fetchTranscriptWithApi] No datasetId returned from Apify actor run');
      return null;
    }
    // Fetch results from the dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) {
      console.error('[fetchTranscriptWithApi] No transcript items returned from Apify dataset');
      return null;
    }
    // Assume the transcript text is in a field called "transcript" or similar
    const transcriptField = items[0].transcript || items[0].text || '';
    if (!transcriptField || typeof transcriptField !== 'string') {
      console.error('[fetchTranscriptWithApi] Transcript field missing or invalid');
      return null;
    }
    return transcriptField;
  } catch (error) {
    console.error('[fetchTranscriptWithApi] Error:', error);
    return null;
  }
}


// Helper function to convert SRT format to plain text
function convertSrtToText(srt: string): string {
  // Remove SRT timestamps and line numbers
  return srt
    .split('\n\n') // Split into caption blocks
    .map(block => {
      // Split block into lines and remove the first two lines (number and timestamp)
      const lines = block.split('\n');
      return lines.slice(2).join(' '); // Join the remaining lines (caption text)
    })
    .filter(line => line.trim() !== '') // Remove empty lines
    .join(' ') // Join all caption text with spaces
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .trim(); // Remove leading/trailing spaces
}


// Function to fetch YouTube transcript (legacy, direct fetch)
export async function fetchTranscriptLegacy(videoId: string, apiKey: string): Promise<string | null> {
  console.log(`[fetchTranscriptLegacy] 요청 videoId: ${videoId}`);
  try {
    // Try the new API first
    console.log('[fetchTranscriptLegacy] Trying YouTube Data API v3...');
    const apiResult = await fetchTranscriptWithApi(videoId);
    if (apiResult) {
      console.log('[fetchTranscriptLegacy] Successfully fetched transcript using YouTube Data API');
      return apiResult;
    }
    
    // Fallback to the old method if API fails
    console.log('[fetchTranscriptLegacy] Falling back to legacy method...');
    const videoData = await getVideoDetails(videoId, apiKey);
    const videoTitle = videoData.items[0].snippet.title;
    console.log(`[fetchTranscriptLegacy] 비디오 제목: ${videoTitle}`);
    
    // Try Korean captions first
    const transcriptUrl = `https://video.google.com/timedtext?lang=ko&v=${videoId}`;
    console.log(`[fetchTranscriptLegacy] 자막 URL: ${transcriptUrl}`);
    
    const transcriptResponse = await fetch(transcriptUrl);
    console.log(`[fetchTranscriptLegacy] 자막 응답 상태: ${transcriptResponse.status} ${transcriptResponse.statusText}`);
    
    if (!transcriptResponse.ok) {
      // If Korean fails, try English
      console.log(`[fetchTranscriptLegacy] Korean captions not available, trying English...`);
      const enTranscriptUrl = `https://video.google.com/timedtext?lang=en&v=${videoId}`;
      const enResponse = await fetch(enTranscriptUrl);
      
      if (!enResponse.ok) {
        console.error(`[fetchTranscriptLegacy] Failed to fetch captions`);
        return null;
      }
      
      const transcriptXml = await enResponse.text();
      if (!transcriptXml || !transcriptXml.includes('<transcript')) {
        console.log(`[fetchTranscriptLegacy] No valid transcript XML found`);
        return null;
      }
      
      console.log(`[fetchTranscriptLegacy] Successfully fetched English captions`);
      return transcriptXml;
    }
    
    const transcriptXml = await transcriptResponse.text();
    if (!transcriptXml || !transcriptXml.includes('<transcript')) {
      console.log(`[fetchTranscriptLegacy] No valid transcript XML found`);
      return null;
    }
    
    console.log(`[fetchTranscriptLegacy] Successfully fetched Korean captions`);
    return transcriptXml;
  } catch (err) {
    console.error(`[fetchTranscriptLegacy] Error:`, err);
    return null;
  }
}
