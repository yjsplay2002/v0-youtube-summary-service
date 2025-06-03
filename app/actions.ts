"use server";

import { extractVideoId, fetchTranscriptWithApi, fetchTranscriptLegacy, getVideoDetails } from "./lib/youtube";
import { supabase } from "@/app/lib/supabase";
import { generateSummary, formatSummaryAsMarkdown, type AIModel } from "./lib/summary";

// Get current user from session
async function getCurrentUser() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return null;
    }
    
    return session.user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Supabase에서 사용자별 요약 조회
async function getUserVideoSummaryFromDB(videoId: string, userId: string) {
  console.log(`[DB 조회] video_id: ${videoId}, user_id: ${userId}`);
  const { data, error } = await supabase
    .from('video_summaries')
    .select('*')
    .eq('video_id', videoId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116' && error.details && error.details.includes('0 rows')) {
      console.log('[DB 조회 결과 없음]'); 
      return null; 
    } else {
      console.error('[DB 조회 에러]', error);
      return null; 
    }
  }
  
  console.log('[DB 조회 결과] 존재함');
  return data;
}

// 기존 시스템 호환성을 위한 함수 (로그인하지 않은 사용자용)
async function getYoutubeSummaryFromDB(videoId: string) {
  console.log(`[DB 조회 (레거시)] video_id: ${videoId}`);
  const { data, error } = await supabase
    .from('youtube_summaries')
    .select('*')
    .eq('video_id', videoId)
    .single();

  if (error) {
    if (error.code === 'PGRST116' && error.details && error.details.includes('0 rows')) {
      console.log('[DB 조회 결과 없음]'); 
      return null; 
    } else {
      console.error('[DB 조회 에러]', error);
      return null; 
    }
  }
  
  console.log('[DB 조회 결과] 존재함');
  return data;
}

// Supabase에 사용자별 요약 저장
async function upsertUserVideoSummaryToDB({ 
  user_id, 
  video_id, 
  video_title, 
  video_thumbnail, 
  video_duration, 
  summary, 
  summary_prompt 
}: {
  user_id: string,
  video_id: string,
  video_title: string,
  video_thumbnail?: string,
  video_duration?: string,
  summary: string,
  summary_prompt?: string
}) {
  const { error } = await supabase.from('video_summaries').upsert([
    { 
      user_id, 
      video_id, 
      video_title, 
      video_thumbnail, 
      video_duration, 
      summary, 
      summary_prompt 
    }
  ]);
  
  if (error) {
    console.error('[사용자별 요약 저장 에러]', error);
    throw error;
  }
}

// 기존 시스템 호환성을 위한 함수 (레거시)
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
export async function summarizeYoutubeVideo(
  youtubeUrl: string, 
  aiModel: AIModel = 'claude-3-5-sonnet',
  summaryPrompt?: string
): Promise<{ success: boolean; videoId?: string; error?: string; summary?: string }> {
  console.log(`[summarizeYoutubeVideo] 요청 URL: ${youtubeUrl}, AI 모델: ${aiModel}`);
  try {
    // 1. 비디오 ID 추출
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      console.error(`[summarizeYoutubeVideo] 유효하지 않은 URL: ${youtubeUrl}`);
      return { success: false, error: "유효하지 않은 YouTube URL입니다." };
    }
    console.log(`[summarizeYoutubeVideo] 추출된 videoId: ${videoId}`);

    // 2. 현재 사용자 확인
    const currentUser = await getCurrentUser();
    
    // 3. DB에서 기존 요약 조회 (사용자별 또는 전체)
    let dbResult = null;
    if (currentUser) {
      dbResult = await getUserVideoSummaryFromDB(videoId, currentUser.id);
      if (dbResult && dbResult.summary) {
        console.log(`[summarizeYoutubeVideo] 사용자별 DB에서 기존 요약 반환 (videoId: ${videoId})`);
        return { success: true, videoId, summary: dbResult.summary };
      }
    } else {
      // 로그인하지 않은 사용자는 레거시 테이블에서 조회
      dbResult = await getYoutubeSummaryFromDB(videoId);
      if (dbResult && dbResult.summary) {
        console.log(`[summarizeYoutubeVideo] 레거시 DB에서 기존 요약 반환 (videoId: ${videoId})`);
        return { success: true, videoId, summary: dbResult.summary };
      }
    }

    // 4. 자막 가져오기 (YouTube Data API v3 사용)
    console.log(`[summarizeYoutubeVideo] fetchTranscriptWithApi 시도 중...`);
    const apiKey = process.env.YOUTUBE_API_KEY || "";
    let transcript = await fetchTranscriptWithApi(videoId);
    
    if (!transcript) {
      console.log(`[summarizeYoutubeVideo] YouTube Data API로 자막 가져오기 실패, legacy 방식 시도 중...`);
      transcript = await fetchTranscriptLegacy(videoId, apiKey);
    }
    
    if (!transcript) {
      console.error(`[summarizeYoutubeVideo] 자막을 찾을 수 없음: ${videoId}`);
      return { success: false, videoId, error: "자막을 찾을 수 없습니다." };
    }
    
    console.log(`[summarizeYoutubeVideo] 자막 가져오기 성공, 길이: ${transcript.length} 문자`);

    // 5. 요약 생성
    console.log(`[summarizeYoutubeVideo] 요약 생성 시작... (모델: ${aiModel})`);
    const summary = await generateSummary(transcript, aiModel, summaryPrompt);
    const markdown = formatSummaryAsMarkdown(summary, videoId);
    
    // 6. 비디오 메타데이터 가져오기
    const videoDetails = await getVideoDetails(videoId, apiKey);
    const snippet = videoDetails?.items?.[0]?.snippet || {};
    const title = snippet.title || "";
    const channel_title = snippet.channelTitle || "";
    const thumbnail_url = snippet.thumbnails?.medium?.url || "";
    const duration = videoDetails?.items?.[0]?.contentDetails?.duration || "";

    // 7. Supabase에 저장
    if (currentUser) {
      // 로그인한 사용자는 개인 테이블에 저장
      await upsertUserVideoSummaryToDB({
        user_id: currentUser.id,
        video_id: videoId,
        video_title: title,
        video_thumbnail: thumbnail_url,
        video_duration: duration,
        summary: markdown,
        summary_prompt: summaryPrompt
      });
      console.log(`[summarizeYoutubeVideo] 사용자별 Supabase에 요약 결과 저장 완료: ${videoId}`);
    } else {
      // 로그인하지 않은 사용자는 레거시 테이블에 저장
      await upsertYoutubeSummaryToDB({
        video_id: videoId,
        transcript,
        summary: markdown,
        title,
        channel_title,
        thumbnail_url
      });
      console.log(`[summarizeYoutubeVideo] 레거시 Supabase에 요약 결과 저장 완료: ${videoId}`);
    }
    
    return { success: true, videoId, summary: markdown };
  } catch (err) {
    console.error(`[summarizeYoutubeVideo] 오류 발생:`, err);
    return { success: false, error: String(err) };
  }
}

// 요약 가져오기 함수 (사용자별 또는 레거시)
export async function getSummary(videoId: string): Promise<string | null> {
  console.log(`[getSummary] 요청 videoId: ${videoId}`);
  try {
    const currentUser = await getCurrentUser();
    
    let dbResult = null;
    if (currentUser) {
      // 로그인한 사용자는 개인 요약에서 조회
      dbResult = await getUserVideoSummaryFromDB(videoId, currentUser.id);
      if (dbResult && dbResult.summary) {
        console.log(`[getSummary] 사용자별 DB에서 요약 반환: ${videoId}`);
        return dbResult.summary;
      }
    } else {
      // 로그인하지 않은 사용자는 레거시 테이블에서 조회
      dbResult = await getYoutubeSummaryFromDB(videoId);
      if (dbResult && dbResult.summary) {
        console.log(`[getSummary] 레거시 DB에서 요약 반환: ${videoId}`);
        return dbResult.summary;
      }
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

// 사용자별 요약 목록 가져오기 서버 액션
export async function getAllSummaries() {
  try {
    const currentUser = await getCurrentUser();
    
    if (currentUser) {
      // 로그인한 사용자는 개인 요약 목록 조회
      const { data, error } = await supabase
        .from('video_summaries')
        .select('video_id, video_title, video_thumbnail, created_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[getAllSummaries] 사용자별 DB 조회 에러:', error);
        return [];
      }
      
      return data?.map(item => ({
        video_id: item.video_id,
        title: item.video_title,
        channel_title: '', // 새 테이블에는 channel_title이 없으므로 빈 문자열
        thumbnail_url: item.video_thumbnail || '',
        created_at: item.created_at
      })) || [];
    } else {
      // 로그인하지 않은 사용자는 레거시 테이블에서 조회
      const { data, error } = await supabase
        .from('youtube_summaries')
        .select('video_id, title, channel_title, thumbnail_url, created_at')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[getAllSummaries] 레거시 DB 조회 에러:', error);
        return [];
      }
      
      return data || [];
    }
  } catch (err) {
    console.error('[getAllSummaries] 오류 발생:', err);
    return [];
  }
}
