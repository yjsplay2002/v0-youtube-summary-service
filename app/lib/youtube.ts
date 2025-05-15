// app/lib/youtube.ts

/**
 * 유튜브 관련 함수 모음 (ID 추출, 상세정보, 자막 등)
 */
import { YoutubeTranscript } from 'youtube-transcript';

// Function to extract video ID from YouTube URL
export function extractVideoId(url: string): string | null {
  console.log(`[extractVideoId] 입력 URL: ${url}`);
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[7].length === 11 ? match[7] : null;
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

// Function to fetch YouTube transcript using youtube-transcript npm package
export async function fetchTranscriptWithNpm(videoId: string): Promise<string | null> {
  console.log(`[fetchTranscriptWithNpm] 요청 videoId: ${videoId}`);
  try {
    console.log(`[fetchTranscriptWithNpm] YoutubeTranscript.fetchTranscript 호출 중...`);
    let transcriptArr = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' });
    if (!transcriptArr || transcriptArr.length === 0) {
      console.log(`[fetchTranscriptWithNpm] 자막을 찾을 수 없음: ${videoId}`);
      return null;
    }
    const transcript = transcriptArr.map(t => t.text).join(' ');
    console.log(`[fetchTranscriptWithNpm] 자막 가져오기 성공: ${transcript.substring(0, 100)}...`);
    console.log(`[fetchTranscriptWithNpm] 자막 세그먼트 수: ${transcriptArr.length}`);
    return transcript;
  } catch (err: any) {
    console.error(`[fetchTranscriptWithNpm] 오류 발생:`, err);
    // ko 자막이 없고, en 자막이 가능한 경우 en으로 재시도
    const errMsg = err?.message || String(err);
    if (errMsg.includes('No transcripts are available in ko') && errMsg.includes('Available languages: en')) {
      try {
        console.log(`[fetchTranscriptWithNpm] ko 자막 없음, en 자막으로 재시도: ${videoId}`);
        const transcriptArr = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
        if (!transcriptArr || transcriptArr.length === 0) {
          console.log(`[fetchTranscriptWithNpm] en 자막도 없음: ${videoId}`);
          return null;
        }
        const transcript = transcriptArr.map(t => t.text).join(' ');
        console.log(`[fetchTranscriptWithNpm] en 자막 가져오기 성공: ${transcript.substring(0, 100)}...`);
        console.log(`[fetchTranscriptWithNpm] en 자막 세그먼트 수: ${transcriptArr.length}`);
        return transcript;
      } catch (enErr) {
        console.error(`[fetchTranscriptWithNpm] en 자막 재시도 실패:`, enErr);
        return null;
      }
    }
    return null;
  }
}

// Function to fetch YouTube transcript (legacy, direct fetch)
export async function fetchTranscriptLegacy(videoId: string, apiKey: string): Promise<string | null> {
  console.log(`[fetchTranscriptLegacy] 요청 videoId: ${videoId}`);
  try {
    // 비디오 정보 가져오기 (getVideoDetails에서 로그 출력)
    const videoData = await getVideoDetails(videoId, apiKey);
    const videoTitle = videoData.items[0].snippet.title;
    console.log(`[fetchTranscriptLegacy] 비디오 제목: ${videoTitle}`);
    
    // 자막 URL 생성 및 요청
    const transcriptUrl = `https://video.google.com/timedtext?lang=ko&v=${videoId}`;
    console.log(`[fetchTranscriptLegacy] 자막 URL: ${transcriptUrl}`);
    
    const transcriptResponse = await fetch(transcriptUrl);
    console.log(`[fetchTranscriptLegacy] 자막 응답 상태: ${transcriptResponse.status} ${transcriptResponse.statusText}`);
    
    if (!transcriptResponse.ok) {
      console.error(`[fetchTranscriptLegacy] 자막 가져오기 실패: ${transcriptResponse.status}`);
      return null;
    }
    
    const transcriptXml = await transcriptResponse.text();
    if (!transcriptXml || !transcriptXml.includes('<transcript')) {
      console.log(`[fetchTranscriptLegacy] 유효한 자막 XML이 없음`);
      return null;
    }
    
    console.log(`[fetchTranscriptLegacy] 자막 XML 가져오기 성공: ${transcriptXml.substring(0, 100)}...`);
    return transcriptXml;
  } catch (err) {
    console.error(`[fetchTranscriptLegacy] 오류 발생:`, err);
    return null;
  }
}
