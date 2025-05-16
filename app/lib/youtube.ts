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

// Function to fetch video details from YouTube API
export async function getVideoDetails(videoId: string, apiKey: string) {
  console.log(`[getVideoDetails] 요청 videoId: ${videoId}`);
  const videoUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;
  console.log(`[getVideoDetails] API URL: ${videoUrl}`);
  
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
  return data;
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

// Function to fetch YouTube transcript using YouTube Data API v3
export async function fetchTranscriptWithApi(videoId: string, apiKey: string): Promise<string | null> {
  try {
    console.log(`[fetchTranscriptWithApi] Starting for video: ${videoId}`);
    
    // First try the new youtube-transcript-plus method
    const transcript = await fetchTranscript(videoId);
    if (transcript) {
      return transcript;
    }
    
    console.log('[fetchTranscriptWithApi] Falling back to API method');
    
    // Fallback to the original API method if the new method fails
    const captionTracks = await getAvailableCaptionTracks(videoId, apiKey);
    console.log(`[fetchTranscriptWithApi] Found ${captionTracks.length} caption tracks`);
    
    if (captionTracks.length === 0) {
      console.warn('[fetchTranscriptWithApi] No caption tracks found');
      return null;
    }
    
    // 사용 가능한 트랙에서 자막 정보 추출
    console.log(`[fetchTranscriptWithApi] Available languages: ${captionTracks.map(t => t.languageCode).join(', ')}`);
    
    // 한국어 자막 우선 찾기
    const koTrack = captionTracks.find(t => t.languageCode.startsWith('ko'));
    
    // 영어 자막 찾기
    const enTrack = captionTracks.find(t => 
      t.languageCode.startsWith('en') || 
      t.languageCode === 'a.en' || 
      t.languageCode === 'a.en-US'
    );
    
    // 한국어 > 영어 > 첫 번째 사용 가능한 자막 순서로 선택
    const selectedTrack = koTrack || enTrack || captionTracks[0];
    console.log(`[fetchTranscriptWithApi] Selected ${selectedTrack.languageCode} captions`);
    
    // 사용 가능한 언어로 자막 가져오기
    const availableLanguages = captionTracks.map(track => track.languageCode);
    console.log(`[fetchTranscriptWithApi] Trying with available languages: ${availableLanguages.join(', ')}`);
    
    // youtube-transcript-plus 라이브러리를 사용하여 자막 가져오기
    const transcriptText = await fetchTranscript(videoId, availableLanguages);
    if (transcriptText) {
      console.log(`[fetchTranscriptWithApi] Successfully fetched transcript using youtube-transcript-plus`);
      return transcriptText;
    }
    
    console.error('[fetchTranscriptWithApi] Failed to fetch transcript after all attempts');
    return null;
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
    const apiResult = await fetchTranscriptWithApi(videoId, apiKey);
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
