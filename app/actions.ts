"use server";

import { extractVideoId, fetchTranscript, getVideoDetails, type VideoDetails, type ApifyTranscriptData } from "./lib/youtube";
import { supabase, supabaseAdmin } from "@/app/lib/supabase";
import { generateSummary, formatSummaryAsMarkdown, calculateTokenCount, estimateTokensAndCost, type AIModel, type PromptType } from "./lib/summary";
import { isUserAdmin } from "./lib/auth-utils";

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
  console.log(`[게스트 DB 조회] video_id: ${videoId} - 레거시 테이블 조회 시작`);
  const { data, error } = await supabase
    .from('youtube_summaries')
    .select('*')
    .eq('video_id', videoId)
    .single();

  if (error) {
    if (error.code === 'PGRST116' && error.details && error.details.includes('0 rows')) {
      console.log(`[게스트 DB 조회] video_id: ${videoId} - 레거시 테이블에 데이터 없음`); 
      return null; 
    } else {
      console.error(`[게스트 DB 조회] video_id: ${videoId} - 레거시 테이블 조회 에러:`, error);
      return null; 
    }
  }
  
  console.log(`[게스트 DB 조회] video_id: ${videoId} - 레거시 테이블에서 데이터 발견`);
  return data;
}

// Supabase에 사용자별 요약 저장
async function upsertUserVideoSummaryToDB({ 
  user_id, 
  video_id, 
  video_title, 
  video_thumbnail, 
  video_duration, 
  channel_title,
  summary, 
  summary_prompt,
  dialog
}: {
  user_id: string,
  video_id: string,
  video_title: string,
  video_thumbnail?: string,
  video_duration?: string,
  channel_title?: string,
  summary: string,
  summary_prompt?: string,
  dialog?: string
}) {
  console.log(`[upsertUserVideoSummaryToDB] 시작 - user_id: ${user_id}, video_id: ${video_id}`);
  
  // RLS 정책 디버깅을 위한 로깅
  console.log(`[upsertUserVideoSummaryToDB] 삽입할 데이터:`, { 
    user_id, 
    video_id, 
    video_title: video_title.substring(0, 30) + (video_title.length > 30 ? '...' : ''),
    video_thumbnail: video_thumbnail || '',
    video_duration: video_duration || '',
    channel_title: channel_title || '',
    summary_length: summary ? summary.length : 0,
    summary_prompt: summary_prompt || ''
  });
  
  try {
    console.log(`[upsertUserVideoSummaryToDB] supabaseAdmin 클라이언트로 RLS 우회하여 저장 (user_id: ${user_id})`);
    
    // 서버 액션에서 RLS 우회를 위해 supabaseAdmin 클라이언트 사용
    const { data, error } = await supabaseAdmin.from('video_summaries').upsert([
      { 
        user_id, 
        video_id, 
        video_title, 
        video_thumbnail, 
        video_duration, 
        channel_title,
        summary, 
        summary_prompt,
        dialog
      }
    ]).select();
    
    if (error) {
      console.error('[사용자별 요약 저장 에러]', error);
      throw error;
    }
    
    console.log(`[upsertUserVideoSummaryToDB] 성공 - user_id: ${user_id}, video_id: ${video_id}`, data);
    return data;
  } catch (err) {
    console.error('[upsertUserVideoSummaryToDB] 예외 발생:', err);
    throw err;
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
  aiModel: AIModel = 'claude-3-5-haiku',
  summaryPrompt?: string,
  userId?: string,
  promptType: PromptType = 'general_summary'
): Promise<{ success: boolean; videoId?: string; error?: string; summary?: string }> {
  console.log(`[summarizeYoutubeVideo] 요청 URL: ${youtubeUrl}, AI 모델: ${aiModel}, userId: ${userId || 'anonymous'}`);
  try {
    // 1. 비디오 ID 추출
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
      console.error(`[summarizeYoutubeVideo] 유효하지 않은 URL: ${youtubeUrl}`);
      return { success: false, error: "유효하지 않은 YouTube URL입니다." };
    }
    console.log(`[summarizeYoutubeVideo] 추출된 videoId: ${videoId}`);

    // 2. 사용자 권한 확인 및 모델 제한
    if (userId) {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
      const userIsAdmin = isUserAdmin(user);
      
      // 비관리자는 Sonnet 모델까지 사용 가능
      if (!userIsAdmin && !['claude-3-5-haiku', 'claude-3-5-sonnet'].includes(aiModel)) {
        console.log(`[summarizeYoutubeVideo] 비관리자가 제한된 모델 사용 시도: ${aiModel}, Sonnet으로 변경`);
        aiModel = 'claude-3-5-sonnet';
      }
    } else {
      // 게스트 사용자는 Haiku 모델만 사용 가능
      if (aiModel !== 'claude-3-5-haiku') {
        console.log(`[summarizeYoutubeVideo] 게스트가 제한된 모델 사용 시도: ${aiModel}, Haiku로 변경`);
        aiModel = 'claude-3-5-haiku';
      }
    }

    // 3. DB에서 기존 요약 조회 (사용자별 또는 전체)
    let dbResult = null;
    if (userId) {
      dbResult = await getUserVideoSummaryFromDB(videoId, userId);
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

    // 4. 자막 가져오기
    console.log(`[summarizeYoutubeVideo] 자막 가져오기 시도 중...`);
    const apifyRawData = await fetchTranscript(videoId);
    
    if (!apifyRawData) {
      console.error(`[summarizeYoutubeVideo] Apify 데이터를 가져올 수 없음: ${videoId}`);
      return { success: false, videoId, error: "자막을 찾을 수 없습니다." };
    }
    
    // RawData 전체를 transcript로 사용
    const transcript = JSON.stringify(apifyRawData);
    
    console.log(`[summarizeYoutubeVideo] Apify 데이터 가져오기 성공, 전체 데이터 길이: ${transcript.length} 문자`);

    // 5. 요약 생성 전 토큰 수 미리 확인
    const estimatedTokens = calculateTokenCount(transcript, aiModel);
    console.log(`[summarizeYoutubeVideo] 예상 토큰 수: ${estimatedTokens}, 모델: ${aiModel}, 프롬프트 타입: ${promptType}`);
    
    if (estimatedTokens > 180000) {
      console.error(`[summarizeYoutubeVideo] 토큰 수가 너무 많습니다 (${estimatedTokens} 토큰). 처리를 중단합니다.`);
      return { success: false, videoId, error: "자막이 너무 길어서 처리할 수 없습니다." };
    }
    
    console.log(`[summarizeYoutubeVideo] 요약 생성 시작... (예상 토큰: ${estimatedTokens})`);
    const summary = await generateSummary(transcript, aiModel, summaryPrompt, promptType);
    const markdown = formatSummaryAsMarkdown(summary, videoId);
    
    // 6. 비디오 메타데이터 가져오기 (Apify 데이터 우선 사용)
    let title = apifyRawData.videoTitle || "";
    let channel_title = apifyRawData.channelName || "";
    let thumbnail_url = "";
    let duration = "";
    
    // YouTube API로 추가 정보 보완
    try {
      const videoDetails = await getVideoDetails(videoId);
      const snippet = videoDetails?.items?.[0]?.snippet || {};
      
      // Apify 데이터가 없으면 YouTube API 데이터 사용
      if (!title) title = snippet.title || "";
      if (!channel_title) channel_title = snippet.channelTitle || "";
      thumbnail_url = snippet.thumbnails?.medium?.url || "";
      duration = videoDetails?.items?.[0]?.contentDetails?.duration || "";
    } catch (error) {
      console.warn(`[summarizeYoutubeVideo] YouTube API 메타데이터 가져오기 실패:`, error);
      // Apify 데이터만으로도 계속 진행 가능
    }

    // 7. Supabase에 저장 (게스트 사용자 우선 처리)
    try {
      if (userId) {
        // 로그인한 사용자는 개인 테이블에 저장 (dialog 필드에 Apify 전체 데이터 저장)
        await upsertUserVideoSummaryToDB({
          user_id: userId,
          video_id: videoId,
          video_title: title,
          video_thumbnail: thumbnail_url,
          video_duration: duration,
          channel_title: channel_title,
          summary: markdown,
          summary_prompt: summaryPrompt,
          dialog: JSON.stringify(apifyRawData)
        });
        console.log(`[summarizeYoutubeVideo] 사용자별 Supabase에 요약 결과 저장 완료: ${videoId}`);
      } else {
        // 게스트 사용자는 레거시 테이블에 즉시 저장
        console.log(`[summarizeYoutubeVideo] 게스트 사용자 - 레거시 테이블에 저장 시작: ${videoId}`);
        await upsertYoutubeSummaryToDB({
          video_id: videoId,
          transcript: transcript, // rawData JSON 전체
          summary: markdown,
          title,
          channel_title,
          thumbnail_url
        });
        console.log(`[summarizeYoutubeVideo] 게스트 사용자 - 레거시 Supabase에 요약 결과 저장 완료: ${videoId}`);
      }
    } catch (saveError) {
      console.error(`[summarizeYoutubeVideo] DB 저장 오류:`, saveError);
      // 저장 실패해도 요약 결과는 반환 (클라이언트에서 사용 가능)
    }
    
    return { success: true, videoId, summary: markdown };
  } catch (err) {
    console.error(`[summarizeYoutubeVideo] 오류 발생:`, err);
    return { success: false, error: String(err) };
  }
}

// 요약 가져오기 함수 (사용자별 또는 레거시)
export async function getSummary(videoId: string, userId?: string): Promise<string | null> {
  console.log(`[getSummary] 요청 videoId: ${videoId}, userId: ${userId || 'anonymous'}`);
  try {
    if (userId) {
      // 로그인한 사용자: 개인 테이블에서 우선 조회
      console.log(`[getSummary] 로그인한 사용자 - 개인 테이블에서 조회: ${userId}`);
      const userSummary = await getUserVideoSummaryFromDB(videoId, userId);
      if (userSummary && userSummary.summary) {
        console.log(`[getSummary] 개인 테이블에서 요약 반환: ${videoId}`);
        return userSummary.summary;
      }
      
      // 개인 테이블에 없으면 레거시 테이블도 확인 (하위 호환성)
      console.log(`[getSummary] 개인 테이블에 없음, 레거시 테이블 확인: ${videoId}`);
      const legacyResult = await getYoutubeSummaryFromDB(videoId);
      if (legacyResult && legacyResult.summary) {
        console.log(`[getSummary] 레거시 테이블에서 요약 반환: ${videoId}`);
        return legacyResult.summary;
      }
    } else {
      // 로그인하지 않은 사용자: 레거시 테이블에서만 조회
      console.log(`[getSummary] 게스트 사용자 - 레거시 테이블에서 조회 시작: ${videoId}`);
      const legacyResult = await getYoutubeSummaryFromDB(videoId);
      if (legacyResult && legacyResult.summary) {
        console.log(`[getSummary] 게스트 사용자 - 레거시 테이블에서 요약 반환 성공: ${videoId}`);
        return legacyResult.summary;
      } else {
        console.warn(`[getSummary] 게스트 사용자 - 레거시 테이블에서 요약을 찾을 수 없음: ${videoId}`);
      }
    }
    
    // 결과 없음
    console.log(`[getSummary] DB에 요약 없음: ${videoId}`);
    return null;
  } catch (err) {
    console.error(`[getSummary] DB 조회 오류:`, err);
    return null;
  }
}

/**
 * YouTube 영상 정보를 가져오는 서버 액션
 * 이 함수의 실제 구현은 app/lib/youtube.ts의 getVideoDetails로 이동되었습니다.
 * 이 서버 액션은 클라이언트의 호출을 위한 래퍼(wrapper) 역할을 합니다.
 * @param videoId 유튜브 비디오 ID
 * @returns 비디오 상세 정보
 * @throws {Error} API 호출 중 에러 발생 시
 */
export async function fetchVideoDetailsServer(videoId: string): Promise<VideoDetails> {
  try {
    console.log(`[fetchVideoDetailsServer] Calling getVideoDetails for video: ${videoId}`);
    // 실제 로직은 lib/youtube.ts에 위임
    const details = await getVideoDetails(videoId);
    return details;
  } catch (error) {
    console.error(`[fetchVideoDetailsServer] Error calling getVideoDetails:`, error);
    // 에러를 다시 throw하여 클라이언트 측에서 처리할 수 있도록 함
    throw error;
  }
}

// 기존 트랜스크립트를 사용하여 다시 요약하는 서버 액션
export async function resummarizeYoutubeVideo(
  videoId: string,
  userId: string,
  aiModel: AIModel = 'claude-3-5-haiku',
  summaryPrompt?: string,
  promptType: PromptType = 'general_summary'
): Promise<{ success: boolean; videoId?: string; error?: string; summary?: string }> {
  console.log(`[resummarizeYoutubeVideo] 요청 videoId: ${videoId}, userId: ${userId}, AI 모델: ${aiModel}`);
  try {
    // 1. 사용자 ID 확인
    if (!userId) {
      console.error(`[resummarizeYoutubeVideo] 로그인이 필요합니다.`);
      return { success: false, error: "로그인이 필요합니다." };
    }

    // 2. 사용자 권한 확인 및 모델 제한
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userIsAdmin = isUserAdmin(user);
    
    // 비관리자는 Sonnet 모델까지 사용 가능
    if (!userIsAdmin && !['claude-3-5-haiku', 'claude-3-5-sonnet'].includes(aiModel)) {
      console.log(`[resummarizeYoutubeVideo] 비관리자가 제한된 모델 사용 시도: ${aiModel}, Sonnet으로 변경`);
      aiModel = 'claude-3-5-sonnet';
    }
    
    // 3. 비디오 정보 및 기존 트랜스크립트 가져오기
    let transcript = "";
    let title = "";
    let thumbnail_url = "";
    let duration = "";
    let channel_title = "";
    
    // 3-1. 사용자별 DB에서 먼저 확인
    const userSummary = await getUserVideoSummaryFromDB(videoId, userId);
    if (userSummary) {
      title = userSummary.video_title;
      thumbnail_url = userSummary.video_thumbnail || "";
      duration = userSummary.video_duration || "";
    }
    
    // 3-2. 레거시 DB에서 트랜스크립트 확인
    const legacySummary = await getYoutubeSummaryFromDB(videoId);
    if (legacySummary && legacySummary.transcript) {
      transcript = legacySummary.transcript;
      if (!title) title = legacySummary.title;
      if (!thumbnail_url) thumbnail_url = legacySummary.thumbnail_url;
      channel_title = legacySummary.channel_title;
    }
    
    // 3-3. 트랜스크립트가 없으면 오류 반환
    if (!transcript) {
      console.error(`[resummarizeYoutubeVideo] 트랜스크립트를 찾을 수 없습니다: ${videoId}`);
      return { success: false, error: "트랜스크립트를 찾을 수 없습니다." };
    }
    
    // 3. 비디오 정보가 부족하면 YouTube API로 보완
    if (!title || !thumbnail_url) {
      try {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) throw new Error("YOUTUBE_API_KEY is missing");
        
        const videoData = await getVideoDetails(videoId);
        title = title || videoData.items[0].snippet.title;
        channel_title = channel_title || videoData.items[0].snippet.channelTitle;
        thumbnail_url = thumbnail_url || videoData.items[0].snippet.thumbnails.high.url;
        duration = duration || videoData.items[0].contentDetails?.duration;
      } catch (error) {
        console.error(`[resummarizeYoutubeVideo] 비디오 정보 보완 실패:`, error);
        // 비디오 정보 보완 실패는 치명적 오류가 아님 - 계속 진행
      }
    }
    
    // 4. 요약 생성
    console.log(`[resummarizeYoutubeVideo] 요약 생성 시작: ${videoId}, 프롬프트 타입: ${promptType}`);
    const summary = await generateSummary(transcript, aiModel, summaryPrompt, promptType);
    const markdown = formatSummaryAsMarkdown(summary, videoId);
    
    // 5. Supabase에 저장 (기존 dialog 데이터 유지)
    let existingDialog = "";
    if (userSummary && userSummary.dialog) {
      existingDialog = userSummary.dialog;
    }
    
    await upsertUserVideoSummaryToDB({
      user_id: userId,
      video_id: videoId,
      video_title: title,
      video_thumbnail: thumbnail_url,
      video_duration: duration,
      channel_title: channel_title,
      summary: markdown,
      summary_prompt: summaryPrompt,
      dialog: existingDialog
    });
    console.log(`[resummarizeYoutubeVideo] Supabase에 요약 결과 저장 완료: ${videoId}`);
    
    return { success: true, videoId, summary: markdown };
  } catch (err) {
    console.error(`[resummarizeYoutubeVideo] 오류 발생:`, err);
    return { success: false, error: String(err) };
  }
}

// 사용자별 요약 목록 가져오기 서버 액션
export async function getAllSummaries(userId?: string) {
  try {
    if (userId) {
      // 로그인한 사용자는 개인 요약 목록 조회 (모든 데이터)
      console.log(`[getAllSummaries] 로그인한 사용자 요약 조회: ${userId}`);
      // 일반 클라이언트 사용 (RLS 정책에 의존)
      const { data, error } = await supabase
        .from('video_summaries')
        .select('video_id, video_title, video_thumbnail, channel_title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[getAllSummaries] 사용자별 DB 조회 에러:', error);
        return [];
      }
      
      console.log(`[getAllSummaries] 로그인한 사용자(${userId}) 요약 조회 결과: ${data?.length || 0}개 레코드`);
      
      return data?.map(item => ({
        video_id: item.video_id,
        title: item.video_title,
        channel_title: item.channel_title || '',
        thumbnail_url: item.video_thumbnail || '',
        created_at: item.created_at
      })) || [];
    } else {
      // 로그인하지 않은 사용자는 레거시 테이블에서 최신 20개만 조회
      console.log('[getAllSummaries] 로그인하지 않은 사용자 - 레거시 테이블에서 최신 20개 조회');
      const { data, error } = await supabase
        .from('youtube_summaries')
        .select('video_id, title, channel_title, thumbnail_url, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('[getAllSummaries] 레거시 DB 조회 에러:', error);
        return [];
      }
      
      console.log(`[getAllSummaries] 비로그인 사용자 레거시 테이블 조회 결과: ${data?.length || 0}개 레코드`);
      
      return data || [];
    }
  } catch (err) {
    console.error('[getAllSummaries] 오류 발생:', err);
    return [];
  }
}

// 토큰 수 계산 서버 액션 (디버깅/테스트용)
export async function calculateTokensForText(text: string, model: AIModel = 'claude-3-5-haiku'): Promise<{
  tokenCount: number;
  characterCount: number;
  model: string;
}> {
  try {
    const tokenCount = calculateTokenCount(text, model);
    return {
      tokenCount,
      characterCount: text.length,
      model
    };
  } catch (error) {
    console.error('[calculateTokensForText] 토큰 계산 오류:', error);
    return {
      tokenCount: Math.ceil(text.length / 4), // fallback 계산
      characterCount: text.length,
      model
    };
  }
}

// 사용 가능한 프롬프트 타입 목록 가져오기
export async function getAvailablePromptTypes(): Promise<Array<{type: string, title: string, description: string}>> {
  try {
    console.log('[getAvailablePromptTypes] 프롬프트 타입 목록 조회');
    const { data, error } = await supabase
      .from('system_prompts')
      .select('prompt_type, title, description')
      .eq('is_active', true)
      .order('prompt_type', { ascending: true });
    
    if (error) {
      console.error('[getAvailablePromptTypes] DB 조회 에러:', error);
      return [];
    }
    
    console.log(`[getAvailablePromptTypes] 조회 결과: ${data?.length || 0}개 프롬프트 타입`);
    
    return data?.map(item => ({
      type: item.prompt_type,
      title: item.title,
      description: item.description || ''
    })) || [];
  } catch (err) {
    console.error('[getAvailablePromptTypes] 오류 발생:', err);
    return [];
  }
}
