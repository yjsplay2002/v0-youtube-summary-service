"use server";

import { extractVideoId, fetchTranscriptWithApi, fetchTranscriptLegacy, getVideoDetails } from "./lib/youtube";
import { supabase } from "@/app/lib/supabase";
import { generateSummary, formatSummaryAsMarkdown } from "./lib/summary";

// Supabase에서 요약/자막/메타데이터 조회
async function getYoutubeSummaryFromDB(videoId: string) {
  console.log(`[DB 조회] video_id: ${videoId}`);
  const { data, error } = await supabase
    .from('youtube_summaries')
    .select('*')
    .eq('video_id', videoId)
    .single();
  if (error) console.error('[DB 조회 에러]', error);
  if (!data) console.log('[DB 조회 결과 없음]');
  else console.log('[DB 조회 결과] 존재함' );
  return data || null;
}

// Supabase에 요약/자막/메타데이터 저장
async function upsertYoutubeSummaryToDB({ video_id, transcript, summary, title, channel_title, thumbnail_url }: {
  video_id: string,
  transcript: string,
  summary: string,
  title: string,
  channel_title: string,
  thumbnail_url: string
}) {
  await supabase.from('youtube_summaries').upsert([
    { video_id, transcript, summary, title, channel_title, thumbnail_url }
  ]);
}

// 서버 액션: 유튜브 URL을 받아 자막을 가져오고 요약을 생성
export async function summarizeYoutubeVideo(youtubeUrl: string): Promise<{ success: boolean; videoId?: string; error?: string; summary?: string }> {
  console.log(`[summarizeYoutubeVideo] 요청 URL: ${youtubeUrl}`);
  try {
    // 1. 비디오 ID 추출
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      console.error(`[summarizeYoutubeVideo] 유효하지 않은 URL: ${youtubeUrl}`);
      return { success: false, error: "유효하지 않은 YouTube URL입니다." };
    }
    console.log(`[summarizeYoutubeVideo] 추출된 videoId: ${videoId}`);

    // 2. DB에서 기존 요약/자막/메타데이터 조회
    const dbResult = await getYoutubeSummaryFromDB(videoId);
    if (dbResult && dbResult.summary) {
      console.log(`[summarizeYoutubeVideo] DB에서 기존 요약 반환 (videoId: ${videoId})`);
      return { success: true, videoId, summary: dbResult.summary };
    }

    // 3. 자막 가져오기 (YouTube Data API v3 사용)
    console.log(`[summarizeYoutubeVideo] fetchTranscriptWithApi 시도 중...`);
    const apiKey = process.env.YOUTUBE_API_KEY || "";
    let transcript = await fetchTranscriptWithApi(videoId, apiKey);
    
    if (!transcript) {
      console.log(`[summarizeYoutubeVideo] YouTube Data API로 자막 가져오기 실패, legacy 방식 시도 중...`);
      transcript = await fetchTranscriptLegacy(videoId, apiKey);
    }
    
    if (!transcript) {
      console.error(`[summarizeYoutubeVideo] 자막을 찾을 수 없음: ${videoId}`);
      return { success: false, videoId, error: "자막을 찾을 수 없습니다." };
    }
    
    console.log(`[summarizeYoutubeVideo] 자막 가져오기 성공, 길이: ${transcript.length} 문자`);

    // 4. 요약 생성
    console.log(`[summarizeYoutubeVideo] 요약 생성 시작...`);
    const summary = await generateSummary(transcript);
    const markdown = formatSummaryAsMarkdown(summary, videoId);
    
    // 5. 비디오 메타데이터 가져오기
    const videoDetails = await getVideoDetails(videoId, apiKey);
    const snippet = videoDetails?.items?.[0]?.snippet || {};
    const title = snippet.title || "";
    const channel_title = snippet.channelTitle || "";
    const thumbnail_url = snippet.thumbnails?.medium?.url || "";

    // 6. Supabase에 저장
    await upsertYoutubeSummaryToDB({
      video_id: videoId,
      transcript,
      summary: markdown,
      title,
      channel_title,
      thumbnail_url
    });
    console.log(`[summarizeYoutubeVideo] Supabase에 요약 결과 저장 완료: ${videoId}`);
    
    return { success: true, videoId, summary: markdown };
  } catch (err) {
    console.error(`[summarizeYoutubeVideo] 오류 발생:`, err);
    return { success: false, error: String(err) };
  }
}

// 요약 가져오기 함수 (Supabase)
export async function getSummary(videoId: string): Promise<string | null> {
  console.log(`[getSummary] 요청 videoId: ${videoId}`);
  try {
    const dbResult = await getYoutubeSummaryFromDB(videoId);
    if (dbResult && dbResult.summary) {
      console.log(`[getSummary] DB에서 요약 반환: ${videoId}`);
      return dbResult.summary;
    }
    console.log(`[getSummary] DB에 요약 없음: ${videoId}`);
    return null;
  } catch (err) {
    console.error(`[getSummary] DB 조회 오류:`, err);
    return null;
  }
}

// YouTube 영상 정보 가져오기 서버 액션
export async function fetchVideoDetailsServer(videoId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is missing");
  return await getVideoDetails(videoId, apiKey);
}
