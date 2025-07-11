"use server";

import { extractVideoId, fetchTranscript, getVideoDetails, type VideoDetails } from "./lib/youtube";
import { supabase, supabaseAdmin } from "@/app/lib/supabase";
import { generateSummary, formatSummaryAsMarkdown, calculateTokenCount, getSystemPrompt, type AIModel, type PromptType } from "./lib/summary";
import { isUserAdmin } from "./lib/auth-utils";
import { extractVideoKeywords, extractVideoTopics } from "./lib/video-keywords";
import { extractKeywordsFromHistory } from "./lib/curation-utils";
import { processAndStoreVideoChunks } from "@/app/lib/rag";

// Supabase에서 사용자별 요약 조회
async function getUserVideoSummaryFromDB(videoId: string, userId: string, language?: string) {
  console.log(`[DB 조회] video_id: ${videoId}, user_id: ${userId}, language: ${language || 'default'}`);
  
  let query = supabase
    .from('video_summaries')
    .select('*')
    .eq('video_id', videoId)
    .eq('user_id', userId);
  
  if (language) {
    query = query.eq('language', language);
  }
  
  const { data, error } = await query.single();

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

// 게스트 사용자용 요약 조회 (video_summaries 테이블에서 user_id가 null인 데이터)
async function getGuestVideoSummaryFromDB(videoId: string, language?: string) {
  console.log(`[게스트 DB 조회] video_id: ${videoId}, language: ${language || 'default'} - video_summaries 테이블에서 게스트 데이터 조회`);
  
  let query = supabase
    .from('video_summaries')
    .select('*')
    .eq('video_id', videoId)
    .is('user_id', null);
  
  if (language) {
    query = query.eq('language', language);
  }
  
  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116' && error.details && error.details.includes('0 rows')) {
      console.log(`[게스트 DB 조회] video_id: ${videoId} - 게스트 데이터 없음`); 
      return null; 
    } else {
      console.error(`[게스트 DB 조회] video_id: ${videoId} - 게스트 데이터 조회 에러:`, error);
      return null; 
    }
  }
  
  console.log(`[게스트 DB 조회] video_id: ${videoId} - 게스트 데이터 발견`);
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
  video_tags,
  video_description,
  inferred_topics,
  inferred_keywords,
  summary, 
  summary_prompt,
  dialog,
  language
}: {
  user_id: string,
  video_id: string,
  video_title: string,
  video_thumbnail?: string,
  video_duration?: string,
  channel_title?: string,
  video_tags?: string[],
  video_description?: string,
  inferred_topics?: string[],
  inferred_keywords?: string[],
  summary: string,
  summary_prompt?: string,
  dialog?: string,
  language?: string
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
    video_tags_count: video_tags?.length || 0,
    inferred_topics_count: inferred_topics?.length || 0,
    inferred_keywords_count: inferred_keywords?.length || 0,
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
        video_tags,
        video_description,
        inferred_topics,
        inferred_keywords,
        summary, 
        summary_prompt,
        dialog,
        language: language || 'en'
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

// 게스트 사용자용 요약 저장 (video_summaries 테이블에 user_id null로 저장)
async function upsertGuestVideoSummaryToDB({ 
  video_id, 
  summary, 
  video_title, 
  channel_title, 
  video_thumbnail, 
  video_duration,
  video_tags,
  video_description,
  inferred_topics,
  inferred_keywords,
  dialog,
  language
}: {
  video_id: string,
  summary: string,
  video_title: string,
  channel_title?: string,
  video_thumbnail?: string,
  video_duration?: string,
  video_tags?: string[],
  video_description?: string,
  inferred_topics?: string[],
  inferred_keywords?: string[],
  dialog?: string,
  language?: string
}) {
  console.log(`[upsertGuestVideoSummaryToDB] 게스트 요약 저장 시작: ${video_id}`);
  
  try {
    const { data, error } = await supabaseAdmin.from('video_summaries').upsert([
      { 
        user_id: null, // 게스트 사용자는 user_id를 null로 설정
        video_id, 
        video_title,
        video_thumbnail,
        video_duration,
        channel_title,
        video_tags,
        video_description,
        inferred_topics,
        inferred_keywords,
        summary,
        dialog,
        language: language || 'en'
      }
    ]).select();
    
    if (error) {
      console.error('[게스트 요약 저장 에러]', error);
      throw error;
    }
    
    console.log(`[upsertGuestVideoSummaryToDB] 게스트 요약 저장 완료: ${video_id}`);
    return data;
  } catch (err) {
    console.error('[upsertGuestVideoSummaryToDB] 예외 발생:', err);
    throw err;
  }
}

// 서버 액션: 유튜브 URL을 받아 자막을 가져오고 요약을 생성
export async function summarizeYoutubeVideo(
  youtubeUrl: string, 
  aiModel: AIModel = 'gemini-2.5-flash',
  summaryPrompt?: string,
  userId?: string,
  promptType: PromptType = 'general_summary',
  language?: string,
  userEmail?: string,
  isUserAdminFromClient?: boolean
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
      console.log(`[summarizeYoutubeVideo] 사용자 정보:`, {
        userId,
        userEmail,
        isUserAdminFromClient
      });
      
      // 클라이언트에서 전달받은 관리자 여부 사용
      // 추가 보안을 위해 이메일도 다시 한번 확인
      let userIsAdmin = isUserAdminFromClient || false;
      if (!userIsAdmin && userEmail) {
        const adminEmails = ['yjs@lnrgame.com'];
        userIsAdmin = adminEmails.includes(userEmail);
        console.log(`[summarizeYoutubeVideo] 이메일 기반 관리자 재확인: ${userEmail} -> ${userIsAdmin}`);
      }
      
      console.log(`[summarizeYoutubeVideo] 최종 관리자 체크 결과: ${userIsAdmin}`);
      
      // 비관리자는 Haiku, Sonnet, Gemini 모델 사용 가능
      if (!userIsAdmin && !['claude-3-5-haiku', 'claude-3-5-sonnet', 'gemini-2.5-flash'].includes(aiModel)) {
        console.log(`[summarizeYoutubeVideo] 비관리자가 제한된 모델 사용 시도: ${aiModel}, Sonnet으로 변경`);
        aiModel = 'claude-3-5-sonnet';
      }
    } else {
      // 게스트 사용자는 Gemini 모델만 사용 가능
      if (aiModel !== 'gemini-2.5-flash') {
        console.log(`[summarizeYoutubeVideo] 게스트가 제한된 모델 사용 시도: ${aiModel}, Gemini로 변경`);
        aiModel = 'gemini-2.5-flash';
      }
    }

    // 3. DB에서 기존 언어별 요약 조회
    console.log(`[summarizeYoutubeVideo] 기존 요약 검색 중... (언어: ${language})`);
    
    // 3-1. 해당 언어의 요약이 이미 있는지 확인
    const { data: existingSummaryCheck } = await supabaseAdmin
      .rpc('summary_exists_for_language', {
        target_video_id: videoId,
        target_language: language || 'en'
      });

    if (existingSummaryCheck) {
      console.log(`[summarizeYoutubeVideo] ${language || 'en'} 언어 요약이 이미 존재함, 기존 요약 반환`);
      
      // 기존 요약을 가져와서 사용자에게 연결
      const existingSummary = await getSummaryWithMetadata(videoId, userId, language);
      if (existingSummary && userId) {
        // 사용자가 이 요약에 접근할 수 있도록 user_summaries에 연결
        const { data: existingSummaryData } = await supabaseAdmin
          .from('video_summaries')
          .select('id')
          .eq('video_id', videoId)
          .eq('language', language || 'en')
          .single();

        if (existingSummaryData) {
          await supabaseAdmin
            .from('user_summaries')
            .upsert({
              user_id: userId,
              summary_id: existingSummaryData.id
            });
        }
      }
      
      return { success: true, videoId, summary: existingSummary?.summary || '' };
    }
    
    // 3-2. 해당 언어의 요약이 없으므로 새로운 요약 생성 진행
    console.log(`[summarizeYoutubeVideo] ${language || 'en'} 언어 요약이 없음, 새로운 요약 생성 시작`);

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
    const summary = await generateSummary(transcript, aiModel, summaryPrompt, promptType, language);
    const markdown = formatSummaryAsMarkdown(summary, videoId);
    
    // 6. 비디오 메타데이터 가져오기 (Apify 데이터 우선 사용)
    let title = apifyRawData.videoTitle || "";
    let channel_title = apifyRawData.channelName || "";
    let thumbnail_url = "";
    let duration = "";
    let description = "";
    let tags: string[] = [];
    
    // YouTube API로 추가 정보 보완
    try {
      const videoDetails = await getVideoDetails(videoId);
      const snippet = videoDetails?.items?.[0]?.snippet || {};
      
      // Apify 데이터가 없으면 YouTube API 데이터 사용
      if (!title) title = snippet.title || "";
      if (!channel_title) channel_title = snippet.channelTitle || "";
      thumbnail_url = snippet.thumbnails?.medium?.url || "";
      duration = videoDetails?.items?.[0]?.contentDetails?.duration || "";
      description = snippet.description || "";
      tags = snippet.tags || [];
    } catch (error) {
      console.warn(`[summarizeYoutubeVideo] YouTube API 메타데이터 가져오기 실패:`, error);
      // Apify 데이터만으로도 계속 진행 가능
    }

    // 7. 키워드와 주제 추출
    const inferredKeywords = extractVideoKeywords(title, description, tags);
    const inferredTopics = extractVideoTopics(title, description, tags);
    
    console.log(`[summarizeYoutubeVideo] 추출된 키워드 (${inferredKeywords.length}개):`, inferredKeywords.slice(0, 5));
    console.log(`[summarizeYoutubeVideo] 추출된 주제 (${inferredTopics.length}개):`, inferredTopics);

    // 8. Supabase에 저장 (새로운 구조 사용)
    try {
      // 먼저 video_summaries 테이블에 요약 저장 (user_id는 원래 작성자 정보로 유지)
      const { data: savedSummary } = await supabaseAdmin
        .from('video_summaries')
        .insert({
          user_id: userId || null, // 원래 작성자 정보 유지 (게스트는 null)
          video_id: videoId,
          video_title: title,
          video_thumbnail: thumbnail_url,
          video_duration: duration,
          channel_title: channel_title,
          video_tags: tags,
          video_description: description,
          inferred_topics: inferredTopics,
          inferred_keywords: inferredKeywords,
          summary: markdown,
          summary_prompt: summaryPrompt,
          dialog: JSON.stringify(apifyRawData),
          language: language || 'en'
        })
        .select('id')
        .single();

      if (savedSummary && userId) {
        // 로그인한 사용자의 경우 user_summaries 테이블에도 연결 추가
        await supabaseAdmin
          .from('user_summaries')
          .insert({
            user_id: userId,
            summary_id: savedSummary.id
          });
        console.log(`[summarizeYoutubeVideo] 요약 저장 및 사용자 연결 완료: ${videoId}`);
      } else {
        console.log(`[summarizeYoutubeVideo] 게스트 요약 저장 완료: ${videoId}`);
      }

      // RAG용 transcript chunks 자동 생성
      console.log(`[summarizeYoutubeVideo] RAG용 transcript chunks 생성 시작: ${videoId}`);
      try {
        const ragResult = await processAndStoreVideoChunks(
          videoId,
          JSON.stringify(apifyRawData),
          {
            maxTokensPerChunk: 500,
            overwriteExisting: false // 기존 청크가 있으면 건너뛰기
          }
        );
        
        if (ragResult.success) {
          console.log(`[summarizeYoutubeVideo] RAG 청크 생성 완료: ${ragResult.chunksStored}개 청크 저장`);
        } else {
          console.warn(`[summarizeYoutubeVideo] RAG 청크 생성 실패: ${ragResult.error}`);
        }
      } catch (ragError) {
        console.error(`[summarizeYoutubeVideo] RAG 처리 중 오류:`, ragError);
        // RAG 실패해도 요약 기능은 정상 작동하도록 함
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

// 모든 요약 결과 조회 (새로운 함수) - 새로운 테이블 구조 사용
export async function getAllVideoSummaries(videoId: string, currentUserId?: string, preferredLanguage?: string): Promise<{
  mySummary?: { summary: string; created_at: string; user_id?: string; language?: string };
  otherSummaries: Array<{ summary: string; created_at: string; user_id?: string; isGuest: boolean; language?: string }>;
  totalSummaries: number;
}> {
  console.log(`[getAllVideoSummaries] 모든 요약 조회 - videoId: ${videoId}, currentUserId: ${currentUserId || 'anonymous'}, preferredLanguage: ${preferredLanguage || 'all'}`);
  
  try {
    // 언어별 요약 조회 - 우선 순위: 선호 언어 -> 영어 -> 모든 언어
    let videoSummariesQuery = supabaseAdmin
      .from('video_summaries')
      .select('id, summary, created_at, user_id, language')
      .eq('video_id', videoId);
    
    // 선호 언어가 지정된 경우 해당 언어만 우선 조회
    if (preferredLanguage) {
      videoSummariesQuery = videoSummariesQuery.eq('language', preferredLanguage);
    }
    
    let { data: videoSummaries, error: summaryError } = await videoSummariesQuery
      .order('created_at', { ascending: false });

    // 선호 언어가 지정되었지만 결과가 없는 경우 폴백하지 않음
    if ((summaryError || !videoSummaries || videoSummaries.length === 0) && preferredLanguage) {
      console.log(`[getAllVideoSummaries] 선호 언어(${preferredLanguage})에서 요약 없음, 폴백하지 않음`);
    }

    if (!videoSummaries || videoSummaries.length === 0) {
      console.log(`[getAllVideoSummaries] 모든 언어에서 요약 없음: ${videoId}`);
      return { otherSummaries: [], totalSummaries: 0 };
    }

    console.log(`[getAllVideoSummaries] 요약 발견: ${videoSummaries.length}개 (다국어)`);

    let mySummary: { summary: string; created_at: string; user_id?: string; language?: string } | undefined;
    const otherSummaries: Array<{ summary: string; created_at: string; user_id?: string; isGuest: boolean; language?: string }> = [];
    
    // 현재 사용자가 접근 가능한 요약들 확인
    for (const videoSummary of videoSummaries) {
      let hasAccess = false;
      let isMyConnection = false;
      
      if (currentUserId) {
        const { data: userSummaryConnection } = await supabaseAdmin
          .from('user_summaries')
          .select('created_at')
          .eq('user_id', currentUserId)
          .eq('summary_id', videoSummary.id)
          .single();

        if (userSummaryConnection) {
          hasAccess = true;
          isMyConnection = true;
          
          if (!mySummary) { // 첫 번째 내 요약만 사용
            mySummary = {
              summary: videoSummary.summary,
              created_at: userSummaryConnection.created_at,
              user_id: currentUserId,
              language: videoSummary.language
            };
            console.log(`[getAllVideoSummaries] 내 요약 발견: ${currentUserId}, 언어: ${videoSummary.language}`);
          }
        }
      }
      
      // 게스트 요약이거나 사용자가 접근 권한이 없으면 다른 요약으로 분류
      if (!isMyConnection) {
        otherSummaries.push({
          summary: videoSummary.summary,
          created_at: videoSummary.created_at,
          user_id: videoSummary.user_id,
          isGuest: videoSummary.user_id === null,
          language: videoSummary.language
        });
      }
    }

    console.log(`[getAllVideoSummaries] 결과 - 내 요약: ${mySummary ? '있음' : '없음'}, 다른 요약: ${otherSummaries.length}개`);

    return {
      mySummary,
      otherSummaries,
      totalSummaries: videoSummaries.length
    };

  } catch (err) {
    console.error(`[getAllVideoSummaries] 오류 발생:`, err);
    return { otherSummaries: [], totalSummaries: 0 };
  }
}

// 요약 가져오기 함수 (기존 호환성 유지 + 개선)
export async function getSummary(videoId: string, userId?: string): Promise<string | null> {
  console.log(`[getSummary] 요청 videoId: ${videoId}, userId: ${userId || 'anonymous'}`);
  
  try {
    // 새로운 getAllVideoSummaries 함수 사용
    const summariesResult = await getAllVideoSummaries(videoId, userId);
    
    // 내 요약이 있으면 우선 반환
    if (summariesResult.mySummary) {
      console.log(`[getSummary] 내 요약 반환: ${videoId}`);
      return summariesResult.mySummary.summary;
    }
    
    // 내 요약이 없으면 다른 요약 중 가장 최근 것 반환
    if (summariesResult.otherSummaries.length > 0) {
      const latestOtherSummary = summariesResult.otherSummaries[0]; // 이미 created_at 기준으로 정렬됨
      console.log(`[getSummary] 다른 사용자의 요약 반환: ${videoId} (${latestOtherSummary.isGuest ? '게스트' : '다른 사용자'})`);
      return latestOtherSummary.summary;
    }
    
    // 결과 없음
    console.log(`[getSummary] DB에 요약 없음: ${videoId}`);
    return null;
  } catch (err) {
    console.error(`[getSummary] DB 조회 오류:`, err);
    return null;
  }
}

// New function that returns summary with metadata including language with fallback support
export async function getSummaryWithMetadata(videoId: string, userId?: string, preferredLanguage?: string): Promise<{
  summary: string;
  language?: string;
  created_at: string;
  user_id?: string;
  isGuest?: boolean;
  foundLanguage?: string;
  isFallback?: boolean;
  availableLanguages?: string[];
} | null> {
  console.log(`[getSummaryWithMetadata] 요청 videoId: ${videoId}, userId: ${userId || 'anonymous'}, preferredLanguage: ${preferredLanguage || 'default'}`);
  
  try {
    // Get user's preferred language if not specified
    let targetLanguage = preferredLanguage;
    if (!targetLanguage && userId) {
      const { data: userPreference } = await supabase
        .from('user_preferences')
        .select('preferred_language')
        .eq('user_id', userId)
        .maybeSingle();
      targetLanguage = userPreference?.preferred_language || 'en';
    }
    targetLanguage = targetLanguage || 'en';

    // Use the new database function for language fallback
    const { data: summaryData, error } = await supabaseAdmin
      .rpc('get_summary_with_language_fallback', {
        target_video_id: videoId,
        preferred_language: targetLanguage
      });

    if (error) {
      console.error(`[getSummaryWithMetadata] DB 함수 호출 오류:`, error);
      return null;
    }

    if (!summaryData || summaryData.length === 0) {
      console.log(`[getSummaryWithMetadata] DB에 요약 없음: ${videoId}`);
      return null;
    }

    const summary = summaryData[0];
    
    // Get available languages for this video
    const { data: availableLanguages } = await supabaseAdmin
      .rpc('get_available_languages_for_video', {
        target_video_id: videoId
      });

    // Check if user has access to this summary (via user_summaries table)
    let hasAccess = true; // Default to true for public summaries
    if (userId) {
      const { data: userSummaryConnection } = await supabaseAdmin
        .from('user_summaries')
        .select('id')
        .eq('user_id', userId)
        .eq('summary_id', summary.id)
        .maybeSingle();
      
      // If this is a user-specific summary but user doesn't have access, check if it's guest summary
      if (summary.user_id && !userSummaryConnection) {
        hasAccess = summary.user_id === null; // Only allow access to guest summaries
      }
    }

    if (!hasAccess) {
      console.log(`[getSummaryWithMetadata] 사용자 접근 권한 없음: ${videoId}`);
      return null;
    }

    console.log(`[getSummaryWithMetadata] 요약 반환: ${videoId}, 언어: ${summary.found_language}, 폴백: ${summary.is_fallback}`);
    
    return {
      summary: summary.summary,
      language: summary.language,
      created_at: summary.created_at,
      user_id: summary.user_id,
      isGuest: summary.user_id === null,
      foundLanguage: summary.found_language,
      isFallback: summary.is_fallback,
      availableLanguages: availableLanguages?.map(lang => lang.language) || []
    };
  } catch (err) {
    console.error(`[getSummaryWithMetadata] DB 조회 오류:`, err);
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

// 기존 dialog 데이터를 사용하여 다시 요약하는 서버 액션 (dialog 기반 재작성)
export async function resummarizeYoutubeVideo(
  videoId: string,
  aiModel: AIModel,
  userId?: string,
  promptType: PromptType = 'general_summary',
  language?: string,
  userEmail?: string,
  isUserAdminFromClient?: boolean
): Promise<{ success: boolean; videoId?: string; error?: string; summary?: string }> {
  console.log(`[resummarizeYoutubeVideo] 재요약 시작 - videoId: ${videoId}, userId: ${userId}, model: ${aiModel}`);
  
  try {
    // 1. 사용자 권한 확인
    if (!userId) {
      console.log(`[resummarizeYoutubeVideo] 사용자 ID 없음`);
      return { success: false, error: "로그인이 필요합니다." };
    }

    // 2. 기존 dialog 데이터에서 트랜스크립트 추출
    let transcript = "";
    let videoData = null;
    
    console.log(`[resummarizeYoutubeVideo] 기존 dialog 데이터 검색 중...`);
    
    // 2-1. 사용자별 요약에서 dialog 필드 확인
    const { data: userSummary } = await supabase
      .from('video_summaries')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', userId)
      .maybeSingle();
    
    console.log(`[resummarizeYoutubeVideo] 사용자 요약 조회:`, { 
      found: !!userSummary, 
      hasDialog: !!userSummary?.dialog
    });
    
    if (userSummary?.dialog) {
      videoData = userSummary;
      console.log(`[resummarizeYoutubeVideo] 사용자 요약에서 dialog 필드 발견`);
      console.log(`[resummarizeYoutubeVideo] dialog 원본 데이터:`, {
        type: typeof userSummary.dialog,
        isString: typeof userSummary.dialog === 'string',
        length: typeof userSummary.dialog === 'string' ? userSummary.dialog.length : 'Not string',
        preview: typeof userSummary.dialog === 'string' ? userSummary.dialog.substring(0, 200) : JSON.stringify(userSummary.dialog).substring(0, 200)
      });
      
      // dialog 필드에서 트랜스크립트 추출
      try {
        let dialogData;
        if (typeof userSummary.dialog === 'string') {
          // JSON 문자열인 경우 파싱
          dialogData = JSON.parse(userSummary.dialog);
          console.log(`[resummarizeYoutubeVideo] JSON 문자열 파싱 완료`);
        } else {
          // 이미 객체인 경우 그대로 사용
          dialogData = userSummary.dialog;
          console.log(`[resummarizeYoutubeVideo] 이미 객체 형태임`);
        }
        
        console.log(`[resummarizeYoutubeVideo] dialog 파싱 결과:`, {
          isArray: Array.isArray(dialogData),
          length: Array.isArray(dialogData) ? dialogData.length : 'Not array',
          firstItemKeys: Array.isArray(dialogData) && dialogData.length > 0 ? Object.keys(dialogData[0]) : 'No first item',
          hasTextInFirstItem: Array.isArray(dialogData) && dialogData.length > 0 && 'text' in dialogData[0],
          firstItemSample: Array.isArray(dialogData) && dialogData.length > 0 ? dialogData[0] : 'No first item'
        });
        
        // dialog 데이터에서 트랜스크립트 추출 (다양한 형태 지원)
        if (Array.isArray(dialogData) && dialogData.length > 0) {
          // 배열 형태: [{text: "..."}, ...] 또는 ["text1", "text2", ...]
          const textParts = dialogData
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object' && 'text' in item) return item.text;
              if (item && typeof item === 'object' && 'content' in item) return item.content;
              return '';
            })
            .filter(text => text && text.trim().length > 0);
          
          transcript = textParts.join(' ');
          console.log(`[resummarizeYoutubeVideo] 배열에서 트랜스크립트 추출:`, {
            totalItems: dialogData.length,
            validTextParts: textParts.length,
            finalLength: transcript.length,
            preview: transcript.substring(0, 200)
          });
        } else if (dialogData && typeof dialogData === 'object') {
          // 객체 형태: dialog 필드에서 다양한 키 확인
          console.log(`[resummarizeYoutubeVideo] 객체 형태 dialog 처리:`, {
            keys: Object.keys(dialogData),
            hasTranscript: 'transcript' in dialogData,
            hasDialog: 'dialog' in dialogData,
            hasItems: 'items' in dialogData,
            hasContent: 'content' in dialogData
          });
          
          // 가능한 트랜스크립트 필드들 확인
          if (dialogData.transcript) {
            if (Array.isArray(dialogData.transcript)) {
              transcript = dialogData.transcript.map((item: any) => 
                typeof item === 'string' ? item : (item?.text || item?.content || '')
              ).join(' ');
            } else if (typeof dialogData.transcript === 'string') {
              transcript = dialogData.transcript;
            }
            console.log(`[resummarizeYoutubeVideo] transcript 필드에서 추출: ${transcript.length}자`);
          } else if (dialogData.dialog && Array.isArray(dialogData.dialog)) {
            transcript = dialogData.dialog.map((item: any) => 
              typeof item === 'string' ? item : (item?.text || item?.content || '')
            ).join(' ');
            console.log(`[resummarizeYoutubeVideo] dialog 필드에서 추출: ${transcript.length}자`);
          } else if (dialogData.items && Array.isArray(dialogData.items)) {
            transcript = dialogData.items.map((item: any) => 
              typeof item === 'string' ? item : (item?.text || item?.content || '')
            ).join(' ');
            console.log(`[resummarizeYoutubeVideo] items 필드에서 추출: ${transcript.length}자`);
          } else if (dialogData.content) {
            transcript = typeof dialogData.content === 'string' ? dialogData.content : '';
            console.log(`[resummarizeYoutubeVideo] content 필드에서 추출: ${transcript.length}자`);
          } else {
            // 모든 값들을 문자열로 합치기 (최후의 수단)
            const allValues = Object.values(dialogData)
              .filter(val => typeof val === 'string' && val.trim().length > 10)
              .join(' ');
            if (allValues.length > 0) {
              transcript = allValues;
              console.log(`[resummarizeYoutubeVideo] 모든 문자열 값에서 추출: ${transcript.length}자`);
            }
          }
          
          if (transcript.trim().length === 0) {
            console.warn(`[resummarizeYoutubeVideo] 객체에서 트랜스크립트 추출 실패, 원본:`, dialogData);
          }
        } else {
          console.warn(`[resummarizeYoutubeVideo] dialog 데이터가 예상 형식이 아님:`, { 
            type: typeof dialogData,
            isArray: Array.isArray(dialogData),
            keys: dialogData && typeof dialogData === 'object' ? Object.keys(dialogData).slice(0, 10) : 'No keys',
            sample: dialogData
          });
        }
      } catch (parseError) {
        console.error(`[resummarizeYoutubeVideo] dialog 파싱 오류:`, parseError);
        console.error(`[resummarizeYoutubeVideo] 원본 dialog 값:`, userSummary.dialog);
      }
    }
    
    // 2-2. 게스트 요약에서 찾기 (사용자 요약에서 트랜스크립트를 찾지 못한 경우)
    if (!transcript) {
      console.log(`[resummarizeYoutubeVideo] 사용자 요약에서 트랜스크립트 없음, 게스트 요약 확인 중...`);
      
      const { data: guestSummary } = await supabase
        .from('video_summaries')
        .select('*')
        .eq('video_id', videoId)
        .is('user_id', null)
        .maybeSingle();
      
      console.log(`[resummarizeYoutubeVideo] 게스트 요약 조회:`, { found: !!guestSummary, hasDialog: !!guestSummary?.dialog });
      
      if (guestSummary?.dialog) {
        if (!videoData) videoData = guestSummary;
        
        // 게스트 요약의 dialog 필드에서 트랜스크립트 추출
        try {
          let dialogData;
          if (typeof guestSummary.dialog === 'string') {
            dialogData = JSON.parse(guestSummary.dialog);
          } else {
            dialogData = guestSummary.dialog;
          }
          
          if (Array.isArray(dialogData)) {
            transcript = dialogData.map((item: any) => 
              typeof item === 'string' ? item : (item?.text || item?.content || '')
            ).join(' ');
          } else if (dialogData && typeof dialogData === 'object') {
            transcript = JSON.stringify(dialogData);
          }
          
          console.log(`[resummarizeYoutubeVideo] 게스트 요약에서 트랜스크립트 추출 성공: ${transcript.length}자`);
        } catch (parseError) {
          console.error(`[resummarizeYoutubeVideo] 게스트 요약 dialog 파싱 오류:`, parseError);
        }
      }
    }
    
    // 2-3. 트랜스크립트가 없으면 API로 새로 가져오기
    if (!transcript || transcript.trim().length === 0) {
      console.log(`[resummarizeYoutubeVideo] DB에 트랜스크립트 없음, API로 새로 가져오기 시도: ${videoId}`);
      
      try {
        // Apify API로 트랜스크립트 가져오기
        const apifyRawData = await fetchTranscript(videoId);
        
        if (apifyRawData && Array.isArray(apifyRawData) && apifyRawData.length > 0) {
          transcript = apifyRawData.map((item: any) => item.text || '').join(' ');
          console.log(`[resummarizeYoutubeVideo] API에서 트랜스크립트 가져오기 성공: ${transcript.length}자`);
          
          // 가져온 트랜스크립트를 dialog 필드에 저장 (향후 재요약을 위해)
          if (userSummary) {
            await supabase
              .from('video_summaries')
              .update({ 
                dialog: JSON.stringify(apifyRawData)
              })
              .eq('video_id', videoId)
              .eq('user_id', userId);
            console.log(`[resummarizeYoutubeVideo] 새로 가져온 트랜스크립트 dialog 필드에 저장 완료`);
          }
        } else {
          console.error(`[resummarizeYoutubeVideo] API에서 유효한 트랜스크립트를 가져오지 못함: ${videoId}`);
          return { success: false, error: "트랜스크립트를 가져올 수 없습니다." };
        }
      } catch (fetchError) {
        console.error(`[resummarizeYoutubeVideo] 트랜스크립트 API 호출 실패:`, fetchError);
        return { success: false, error: "트랜스크립트를 가져오는데 실패했습니다." };
      }
    }

    // 3. 새로운 요약 생성
    console.log(`[resummarizeYoutubeVideo] 새로운 요약 생성 시작 - 모델: ${aiModel}`);
    
    const systemPrompt = await getSystemPrompt(promptType);
    const userPrompt = `다음은 YouTube 비디오의 전체 대화 내용입니다:\n\n${transcript}\n\n위 내용을 체계적으로 요약해주세요.`;
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    
    const newSummary = await generateSummary(fullPrompt, aiModel, undefined, promptType, language);
    const markdown = formatSummaryAsMarkdown(newSummary, videoId);
    console.log(`[resummarizeYoutubeVideo] 새로운 요약 생성 완료: ${newSummary.length}자`);

    // 4. 요약 업데이트 (dialog는 그대로 유지)
    const summaryData = {
      summary: markdown,
      updated_at: new Date().toISOString(),
      language: language || 'en'
    };

    if (userSummary) {
      // 기존 사용자 요약 업데이트
      console.log(`[resummarizeYoutubeVideo] 기존 사용자 요약 업데이트 중...`);
      
      const { error: updateError } = await supabase
        .from('video_summaries')
        .update(summaryData)
        .eq('video_id', videoId)
        .eq('user_id', userId);
      
      if (updateError) {
        console.error(`[resummarizeYoutubeVideo] 요약 업데이트 실패:`, updateError);
        return { success: false, error: "요약 저장에 실패했습니다." };
      }
      
      console.log(`[resummarizeYoutubeVideo] 요약 업데이트 완료`);

      // RAG용 transcript chunks 자동 생성/업데이트
      console.log(`[resummarizeYoutubeVideo] RAG용 transcript chunks 생성 시작: ${videoId}`);
      try {
        // 재요약의 경우 기존 청크를 덮어쓰기
        const ragResult = await processAndStoreVideoChunks(
          videoId,
          transcript,
          {
            maxTokensPerChunk: 500,
            overwriteExisting: true // 재요약이므로 기존 청크를 새로 생성
          }
        );
        
        if (ragResult.success) {
          console.log(`[resummarizeYoutubeVideo] RAG 청크 생성 완료: ${ragResult.chunksStored}개 청크 저장`);
        } else {
          console.warn(`[resummarizeYoutubeVideo] RAG 청크 생성 실패: ${ragResult.error}`);
        }
      } catch (ragError) {
        console.error(`[resummarizeYoutubeVideo] RAG 처리 중 오류:`, ragError);
        // RAG 실패해도 재요약 기능은 정상 작동하도록 함
      }
    } else {
      console.error(`[resummarizeYoutubeVideo] 사용자 요약을 찾을 수 없어 업데이트 불가: ${videoId}`);
      return { success: false, error: "요약 데이터를 찾을 수 없습니다." };
    }
    
    console.log(`[resummarizeYoutubeVideo] 재요약 완료: ${videoId}`);
    return { success: true, videoId, summary: markdown };
    
  } catch (error) {
    console.error(`[resummarizeYoutubeVideo] 재요약 중 오류 발생:`, error);
    return { success: false, error: "재요약 중 오류가 발생했습니다." };
  }
}

// 사용자별 요약 목록 가져오기 서버 액션 (새로운 테이블 구조 사용)
export async function getAllSummaries(userId?: string) {
  try {
    console.log(`[getAllSummaries] 시작 - userId: ${userId || 'anonymous'}`);
    console.log(`[getAllSummaries] 환경 변수 확인:`, {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV
    });
    
    if (userId) {
      // 로그인한 사용자는 user_summaries를 통해 연결된 요약 목록 조회
      console.log(`[getAllSummaries] 로그인한 사용자 요약 조회: ${userId}`);
      
      try {
        // user_summaries 테이블이 있는 경우 새로운 구조 사용
        const { data, error } = await supabaseAdmin
          .from('user_summaries')
          .select(`
            created_at,
            video_summaries!inner(
              video_id,
              video_title,
              video_thumbnail,
              channel_title
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('[getAllSummaries] user_summaries 조회 에러:', error);
          // 새로운 테이블이 없으면 기존 방식으로 폴백
          throw error;
        }
        
        // 새로운 구조에서 데이터 변환
        const summaries = data?.map(item => ({
          video_id: item.video_summaries.video_id,
          title: item.video_summaries.video_title,
          thumbnail_url: item.video_summaries.video_thumbnail,
          channel_title: item.video_summaries.channel_title,
          created_at: item.created_at
        })) || [];
        
        console.log(`[getAllSummaries] 새로운 구조로 로그인한 사용자(${userId}) 요약 조회 결과: ${summaries.length}개 레코드`);
        console.log(`[getAllSummaries] 샘플 데이터:`, summaries.slice(0, 2));
        
        return summaries;
        
      } catch (newStructureError) {
        console.log('[getAllSummaries] 새로운 구조 실패, 기존 구조로 폴백');
        
        // 기존 구조로 폴백
        const { data, error } = await supabaseAdmin
          .from('video_summaries')
          .select('video_id, title:video_title, thumbnail_url:video_thumbnail, channel_title, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('[getAllSummaries] 사용자별 DB 조회 에러:', error);
          return [];
        }
        
        console.log(`[getAllSummaries] 기존 구조로 로그인한 사용자(${userId}) 요약 조회 결과: ${data?.length || 0}개 레코드`);
        return data || [];
      }
    } else {
      // 로그인하지 않은 사용자는 video_summaries에서 최신 20개만 조회 (공개 데이터)
      console.log('[getAllSummaries] 로그인하지 않은 사용자 - video_summaries에서 최신 20개 조회');
      
      // 서버 액션에서는 supabaseAdmin 사용
      const { data, error } = await supabaseAdmin
        .from('video_summaries')
        .select('video_id, title:video_title, thumbnail_url:video_thumbnail, channel_title, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('[getAllSummaries] video_summaries 테이블 조회 에러:', error);
        console.error('[getAllSummaries] 에러 상세:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return [];
      }
      
      console.log(`[getAllSummaries] 비로그인 사용자 video_summaries 조회 결과: ${data?.length || 0}개 레코드`);
      console.log(`[getAllSummaries] 샘플 데이터:`, data?.slice(0, 2));
      
      return data || [];
    }
  } catch (err) {
    console.error('[getAllSummaries] 오류 발생:', err);
    console.error('[getAllSummaries] 오류 타입:', typeof err);
    console.error('[getAllSummaries] 오류 스택:', (err as Error)?.stack);
    return [];
  }
}

// 큐레이션용 비디오 목록 가져오기 서버 액션
export async function getCuratedVideos(userId?: string, pageToken?: string) {
  try {
    // YouTube API 키가 없으면 빈 결과 반환
    if (!process.env.YOUTUBE_API_KEY) {
      console.warn('[getCuratedVideos] YOUTUBE_API_KEY is not configured');
      return { items: [], nextPageToken: undefined };
    }
    
    if (userId) {
      // 로그인한 사용자: 개인화된 큐레이션
      console.log(`[getCuratedVideos] 로그인한 사용자(${userId})를 위한 개인화 큐레이션`);
      
      // 먼저 사용자의 요약 히스토리를 가져옴
      const summaries = await getAllSummaries(userId);
      
      if (summaries.length === 0) {
        // 히스토리가 없으면 트렌딩 비디오 반환
        console.log('[getCuratedVideos] 히스토리가 없음 - 트렌딩 비디오 반환');
        try {
          const { getTrendingVideos } = await import('@/app/lib/youtube');
          return await getTrendingVideos(12, pageToken);
        } catch (trendingError) {
          console.error('[getCuratedVideos] 트렌딩 비디오 가져오기 실패:', trendingError);
          return { items: [], nextPageToken: undefined };
        }
      }
      
      // 사용자 선호도 분석 및 개인화된 검색
      try {
        const { generateCurationQuery } = await import('@/app/lib/curation-utils');
        const { searchVideos } = await import('@/app/lib/youtube');
        
        const query = generateCurationQuery(summaries);
        console.log(`[getCuratedVideos] 개인화 검색 쿼리: "${query}"`);
        
        return await searchVideos(query, 12, pageToken);
      } catch (searchError) {
        console.error('[getCuratedVideos] 개인화 검색 실패:', searchError);
        // 개인화 검색 실패 시 트렌딩으로 폴백
        try {
          const { getTrendingVideos } = await import('@/app/lib/youtube');
          return await getTrendingVideos(12, pageToken);
        } catch (fallbackError) {
          console.error('[getCuratedVideos] 폴백 트렌딩 비디오도 실패:', fallbackError);
          return { items: [], nextPageToken: undefined };
        }
      }
    } else {
      // 게스트 사용자: 게스트 요약 데이터를 기반으로 한 개인화된 큐레이션
      console.log('[getCuratedVideos] 게스트 사용자 - 게스트 요약 데이터 기반 큐레이션');
      
      // 먼저 게스트 요약 히스토리를 가져옴
      const guestSummaries = await getAllSummaries(); // userId 없이 호출하면 guest 데이터 반환
      
      if (guestSummaries.length === 0) {
        // 게스트 요약이 없으면 트렌딩 비디오 반환
        console.log('[getCuratedVideos] 게스트 요약 없음 - 트렌딩 비디오 반환');
        try {
          const { getTrendingVideos } = await import('@/app/lib/youtube');
          return await getTrendingVideos(12, pageToken);
        } catch (trendingError) {
          console.error('[getCuratedVideos] 트렌딩 비디오 가져오기 실패:', trendingError);
          return { items: [], nextPageToken: undefined };
        }
      }
      
      // 게스트 선호도 분석 및 개인화된 검색
      try {
        const { generateCurationQuery } = await import('@/app/lib/curation-utils');
        const { searchVideos } = await import('@/app/lib/youtube');
        
        const query = generateCurationQuery(guestSummaries);
        console.log(`[getCuratedVideos] 게스트 개인화 검색 쿼리: "${query}"`);
        
        return await searchVideos(query, 12, pageToken);
      } catch (searchError) {
        console.error('[getCuratedVideos] 게스트 개인화 검색 실패:', searchError);
        // 개인화 검색 실패 시 트렌딩으로 폴백
        try {
          const { getTrendingVideos } = await import('@/app/lib/youtube');
          return await getTrendingVideos(12, pageToken);
        } catch (fallbackError) {
          console.error('[getCuratedVideos] 폴백 트렌딩 비디오도 실패:', fallbackError);
          return { items: [], nextPageToken: undefined };
        }
      }
    }
  } catch (error) {
    console.error('[getCuratedVideos] 오류 발생:', error);
    // 오류 발생 시 빈 결과 반환
    return { items: [], nextPageToken: undefined };
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

// 사용자의 시청 기록에서 키워드 추출
export async function getUserKeywords(userId: string): Promise<Array<{keyword: string, frequency: number}>> {
  try {
    console.log(`[getUserKeywords] 사용자 키워드 추출 시작: ${userId}`);
    
    // 사용자의 모든 요약 데이터 가져오기 (새로운 필드 포함)
    const { data: summaries, error } = await supabase
      .from('video_summaries')
      .select('video_id, video_title, channel_title, video_thumbnail, created_at, inferred_keywords, inferred_topics')
      .eq('user_id', userId)
      .not('video_title', 'is', null);
    
    if (error) {
      console.error('[getUserKeywords] DB 조회 에러:', error);
      return [];
    }
    
    if (!summaries || summaries.length === 0) {
      console.log('[getUserKeywords] 사용자 요약 데이터가 없음');
      return [];
    }
    
    console.log(`[getUserKeywords] ${summaries.length}개의 요약 데이터에서 키워드 추출`);
    
    // UserSummary 형식으로 변환
    const userSummaries = summaries.map(s => ({
      video_id: s.video_id,
      title: s.video_title,
      channel_title: s.channel_title,
      thumbnail_url: s.video_thumbnail || '',
      created_at: s.created_at,
      inferred_keywords: s.inferred_keywords || [],
      inferred_topics: s.inferred_topics || []
    }));
    
    // 개선된 키워드 추출 함수 사용
    const keywords = extractKeywordsFromHistory(userSummaries);
    
    console.log(`[getUserKeywords] 추출된 키워드: ${keywords.length}개`);
    
    // 키워드별 빈도 계산
    const keywordFrequency = keywords.map((keyword, index) => ({
      keyword,
      frequency: keywords.length - index // 순서대로 빈도 부여
    }));
    
    return keywordFrequency.slice(0, 5); // 상위 5개 반환
    
  } catch (err) {
    console.error('[getUserKeywords] 오류 발생:', err);
    return [];
  }
}

// 게스트 사용자를 위한 키워드 추출 (게스트로 등록된 비디오들에서)
export async function getGuestKeywords(): Promise<Array<{keyword: string, frequency: number}>> {
  try {
    console.log(`[getGuestKeywords] 게스트 키워드 추출 시작`);
    
    // 게스트 사용자 요약 데이터 가져오기 (user_id가 null인 데이터)
    const { data: summaries, error } = await supabase
      .from('video_summaries')
      .select('video_id, video_title, channel_title, video_thumbnail, created_at, inferred_keywords, inferred_topics')
      .is('user_id', null)
      .not('video_title', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50); // 최근 50개 게스트 요약만 사용
    
    if (error) {
      console.error('[getGuestKeywords] DB 조회 에러:', error);
      return [];
    }
    
    if (!summaries || summaries.length === 0) {
      console.log('[getGuestKeywords] 게스트 요약 데이터가 없음');
      return [];
    }
    
    console.log(`[getGuestKeywords] ${summaries.length}개의 게스트 요약 데이터에서 키워드 추출`);
    
    // UserSummary 형식으로 변환
    const userSummaries = summaries.map(s => ({
      video_id: s.video_id,
      title: s.video_title,
      channel_title: s.channel_title,
      thumbnail_url: s.video_thumbnail || '',
      created_at: s.created_at,
      inferred_keywords: s.inferred_keywords || [],
      inferred_topics: s.inferred_topics || []
    }));
    
    // 개선된 키워드 추출 함수 사용
    const keywords = extractKeywordsFromHistory(userSummaries);
    
    console.log(`[getGuestKeywords] 추출된 키워드: ${keywords.length}개`);
    
    // 키워드별 빈도 계산
    const keywordFrequency = keywords.map((keyword, index) => ({
      keyword,
      frequency: keywords.length - index // 순서대로 빈도 부여
    }));
    
    return keywordFrequency.slice(0, 5); // 상위 5개 반환
    
  } catch (err) {
    console.error('[getGuestKeywords] 오류 발생:', err);
    return [];
  }
}

// 비디오 요약 존재 여부 확인 (단일)
export async function checkVideoSummaryExists(videoId: string, userId?: string): Promise<boolean> {
  try {
    console.log(`[checkVideoSummaryExists] 요약 존재 확인: ${videoId}, userId: ${userId || 'guest'}`);
    
    if (userId) {
      // 로그인한 사용자의 개인 요약 확인
      const { data: userSummary, error: userError } = await supabase
        .from('video_summaries')
        .select('id')
        .eq('video_id', videoId)
        .eq('user_id', userId)
        .single();
      
      if (userError && userError.code !== 'PGRST116') { // PGRST116은 no rows 에러
        console.error('[checkVideoSummaryExists] 개인 요약 조회 에러:', userError);
      }
      
      if (userSummary) {
        console.log(`[checkVideoSummaryExists] 개인 요약 존재: ${videoId}`);
        return true;
      }
    }
    
    // 게스트 요약 확인
    const { data: guestSummary, error: guestError } = await supabase
      .from('video_summaries')
      .select('id')
      .eq('video_id', videoId)
      .is('user_id', null)
      .single();
    
    if (guestError && guestError.code !== 'PGRST116') {
      console.error('[checkVideoSummaryExists] 게스트 요약 조회 에러:', guestError);
    }
    
    if (guestSummary) {
      console.log(`[checkVideoSummaryExists] 게스트 요약 존재: ${videoId}`);
      return true;
    }
    
    console.log(`[checkVideoSummaryExists] 요약 없음: ${videoId}`);
    return false;
    
  } catch (err) {
    console.error('[checkVideoSummaryExists] 오류 발생:', err);
    return false;
  }
}

// 여러 비디오의 요약 존재 여부를 배치로 확인
export async function checkMultipleVideoSummaryExists(videoIds: string[], userId?: string): Promise<{[videoId: string]: boolean}> {
  try {
    if (!videoIds.length) return {};
    
    console.log(`[checkMultipleVideoSummaryExists] 배치 요약 존재 확인: ${videoIds.length}개 비디오, userId: ${userId || 'guest'}`);
    
    const result: {[videoId: string]: boolean} = {};
    
    // 모든 비디오 ID에 대해 기본값 false 설정
    videoIds.forEach(id => {
      result[id] = false;
    });
    
    if (userId) {
      // 로그인한 사용자의 개인 요약들 확인
      const { data: userSummaries, error: userError } = await supabase
        .from('video_summaries')
        .select('video_id')
        .in('video_id', videoIds)
        .eq('user_id', userId);
      
      if (userError) {
        console.error('[checkMultipleVideoSummaryExists] 개인 요약 조회 에러:', userError);
      } else if (userSummaries) {
        userSummaries.forEach(summary => {
          result[summary.video_id] = true;
        });
        console.log(`[checkMultipleVideoSummaryExists] 개인 요약 발견: ${userSummaries.length}개`);
      }
    }
    
    // 게스트 요약들 확인 (아직 요약이 없는 비디오들만)
    const remainingVideoIds = videoIds.filter(id => !result[id]);
    if (remainingVideoIds.length > 0) {
      const { data: guestSummaries, error: guestError } = await supabase
        .from('video_summaries')
        .select('video_id')
        .in('video_id', remainingVideoIds)
        .is('user_id', null);
      
      if (guestError) {
        console.error('[checkMultipleVideoSummaryExists] 게스트 요약 조회 에러:', guestError);
      } else if (guestSummaries) {
        guestSummaries.forEach(summary => {
          result[summary.video_id] = true;
        });
        console.log(`[checkMultipleVideoSummaryExists] 게스트 요약 발견: ${guestSummaries.length}개`);
      }
    }
    
    const existsCount = Object.values(result).filter(Boolean).length;
    console.log(`[checkMultipleVideoSummaryExists] 결과: ${existsCount}/${videoIds.length}개 요약 존재`);
    
    return result;
    
  } catch (err) {
    console.error('[checkMultipleVideoSummaryExists] 오류 발생:', err);
    // 에러 발생 시 모든 비디오에 대해 false 반환
    const result: {[videoId: string]: boolean} = {};
    videoIds.forEach(id => {
      result[id] = false;
    });
    return result;
  }
}

// 키워드로 YouTube 동영상 검색 (페이지네이션 지원)
export async function searchVideosByKeyword(keyword: string, maxResults: number = 10, pageToken?: string): Promise<{
  videos: Array<{
    id: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    publishedAt: string;
    duration: string;
    description?: string;
  }>;
  nextPageToken?: string;
}> {
  try {
    console.log(`[searchVideosByKeyword] 키워드 검색 시작: "${keyword}", 최대 결과: ${maxResults}, 페이지 토큰: ${pageToken || 'none'}`);
    
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('[searchVideosByKeyword] YouTube API 키가 설정되지 않음');
      return { videos: [] };
    }
    
    // YouTube Data API v3를 사용한 검색
    let searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&` +
      `q=${encodeURIComponent(keyword)}&` +
      `type=video&` +
      `videoDuration=medium&` + // 4분~20분 영상
      `videoDefinition=high&` +
      `videoEmbeddable=true&` + // 임베드 가능한 비디오만
      `order=relevance&` +
      `maxResults=${maxResults}&` +
      `key=${apiKey}`;
    
    if (pageToken) {
      searchUrl += `&pageToken=${pageToken}`;
    }
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`YouTube 검색 API 오류: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    
    if (!searchData.items || searchData.items.length === 0) {
      console.log(`[searchVideosByKeyword] "${keyword}"에 대한 검색 결과 없음`);
      return { videos: [] };
    }
    
    // 비디오 ID 목록 추출
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    
    // 비디오 상세 정보 가져오기 (재생 시간 및 상태 포함)
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
      `part=snippet,contentDetails,status&` +
      `id=${videoIds}&` +
      `key=${apiKey}`;
    
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) {
      throw new Error(`YouTube 상세정보 API 오류: ${detailsResponse.status}`);
    }
    
    const detailsData = await detailsResponse.json();
    
    // 재생 가능한 비디오만 필터링
    const videos = detailsData.items
      .filter((item: any) => {
        // 비디오 상태 확인: 공개되어 있고 임베드 가능한 것만
        return item.status?.uploadStatus === 'processed' && 
               item.status?.privacyStatus === 'public' &&
               item.status?.embeddable !== false;
      })
      .map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
        publishedAt: item.snippet.publishedAt,
        duration: item.contentDetails.duration,
        description: item.snippet.description
      }));
    
    console.log(`[searchVideosByKeyword] 검색 완료: ${videos.length}개 재생 가능한 동영상`);
    return { 
      videos, 
      nextPageToken: searchData.nextPageToken 
    };
    
  } catch (err) {
    console.error('[searchVideosByKeyword] 오류 발생:', err);
    return { videos: [] };
  }
}

// 실시간 급등 영상 조회 (정보전달 컨텐츠 위주)
export async function getTrendingVideos(maxResults: number = 10) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('[getTrendingVideos] YOUTUBE_API_KEY 환경변수가 설정되지 않음');
      return { videos: [] };
    }

    let allVideos = [];
    
    // 1차 시도: 정보전달 관련 카테고리 (뉴스, 교육, 과학기술)
    const infoCategories = ['25', '27', '28']; // News & Politics, Education, Science & Technology
    
    for (const categoryId of infoCategories) {
      const url = `https://www.googleapis.com/youtube/v3/videos?` +
        `part=snippet,contentDetails,statistics&` +
        `chart=mostPopular&` +
        `regionCode=KR&` +
        `categoryId=${categoryId}&` +
        `maxResults=${Math.ceil(maxResults / infoCategories.length)}&` +
        `key=${apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[getTrendingVideos] YouTube API 오류 (카테고리 ${categoryId}): ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const videos = data.items
          .filter((item: any) => {
            // 재생 가능한 비디오만 필터링
            return item.snippet.liveBroadcastContent !== 'live' && 
                   item.snippet.categoryId === categoryId;
          })
          .map((item: any) => ({
            id: item.id,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
            publishedAt: item.snippet.publishedAt,
            duration: item.contentDetails.duration,
            description: item.snippet.description,
            viewCount: item.statistics.viewCount,
            category: categoryId
          }));
        
        allVideos.push(...videos);
      }
    }
    
    // 결과가 부족하면 2차 시도: 전체 인기 동영상 (카테고리 제한 없음)
    if (allVideos.length < maxResults / 2) {
      console.log(`[getTrendingVideos] 정보 카테고리에서 ${allVideos.length}개만 발견, 전체 인기 동영상 추가 조회`);
      
      const fallbackUrl = `https://www.googleapis.com/youtube/v3/videos?` +
        `part=snippet,contentDetails,statistics&` +
        `chart=mostPopular&` +
        `regionCode=KR&` +
        `maxResults=${maxResults}&` +
        `key=${apiKey}`;
      
      const fallbackResponse = await fetch(fallbackUrl);
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackData.items && fallbackData.items.length > 0) {
          const fallbackVideos = fallbackData.items
            .filter((item: any) => {
              // 이미 있는 비디오 제외, 라이브 방송 제외
              return item.snippet.liveBroadcastContent !== 'live' &&
                     !allVideos.some(v => v.id === item.id);
            })
            .map((item: any) => ({
              id: item.id,
              title: item.snippet.title,
              channelTitle: item.snippet.channelTitle,
              thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
              publishedAt: item.snippet.publishedAt,
              duration: item.contentDetails.duration,
              description: item.snippet.description,
              viewCount: item.statistics.viewCount,
              category: item.snippet.categoryId || 'general'
            }));
          
          allVideos.push(...fallbackVideos);
        }
      }
    }
    
    // 여전히 결과가 부족하면 3차 시도: 글로벌 인기 동영상 (지역 제한 없음)
    if (allVideos.length < maxResults / 2) {
      console.log(`[getTrendingVideos] 한국 동영상에서 ${allVideos.length}개만 발견, 글로벌 인기 동영상 추가 조회`);
      
      const globalUrl = `https://www.googleapis.com/youtube/v3/videos?` +
        `part=snippet,contentDetails,statistics&` +
        `chart=mostPopular&` +
        `maxResults=${maxResults}&` +
        `key=${apiKey}`;
      
      const globalResponse = await fetch(globalUrl);
      if (globalResponse.ok) {
        const globalData = await globalResponse.json();
        
        if (globalData.items && globalData.items.length > 0) {
          const globalVideos = globalData.items
            .filter((item: any) => {
              // 이미 있는 비디오 제외, 라이브 방송 제외
              return item.snippet.liveBroadcastContent !== 'live' &&
                     !allVideos.some(v => v.id === item.id);
            })
            .map((item: any) => ({
              id: item.id,
              title: item.snippet.title,
              channelTitle: item.snippet.channelTitle,
              thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
              publishedAt: item.snippet.publishedAt,
              duration: item.contentDetails.duration,
              description: item.snippet.description,
              viewCount: item.statistics.viewCount,
              category: item.snippet.categoryId || 'global'
            }));
          
          allVideos.push(...globalVideos);
        }
      }
    }
    
    // 조회수 기준으로 정렬하고 중복 제거
    const uniqueVideos = allVideos
      .sort((a, b) => parseInt(b.viewCount) - parseInt(a.viewCount))
      .slice(0, maxResults);
    
    console.log(`[getTrendingVideos] 급등 영상 조회 완료: ${uniqueVideos.length}개`);
    return { videos: uniqueVideos };
    
  } catch (err) {
    console.error('[getTrendingVideos] 오류 발생:', err);
    return { videos: [] };
  }
}

// 특정 비디오와 관련된 영상 조회 (관리자 전용)
export async function getRelatedVideos(videoId: string, maxResults: number = 10, userEmail?: string) {
  try {
    // 관리자 권한 확인 (하드코딩된 관리자 이메일 체크)
    const adminEmails = ['yjs@lnrgame.com'];
    if (!userEmail || !adminEmails.includes(userEmail)) {
      console.log('[getRelatedVideos] 관리자 권한이 필요한 기능입니다');
      return { videos: [] };
    }

    // 네트워크 이슈로 인한 임시 비활성화
    console.log('[getRelatedVideos] 관련 영상 기능이 임시로 비활성화되었습니다 (네트워크 이슈)');
    return { videos: [] };

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('[getRelatedVideos] YOUTUBE_API_KEY 환경변수가 설정되지 않음');
      return { videos: [] };
    }

    // 먼저 원본 비디오 정보 조회
    const videoUrl = `https://www.googleapis.com/youtube/v3/videos?` +
      `part=snippet&` +
      `id=${videoId}&` +
      `key=${apiKey}`;
    
    const videoResponse = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(10000) // 10초 타임아웃
    });
    if (!videoResponse.ok) {
      throw new Error(`YouTube 비디오 정보 API 오류: ${videoResponse.status}`);
    }
    
    const videoData = await videoResponse.json();
    if (!videoData.items || videoData.items.length === 0) {
      console.log(`[getRelatedVideos] 비디오 ${videoId}를 찾을 수 없음`);
      return { videos: [] };
    }
    
    const originalVideo = videoData.items[0];
    const channelId = originalVideo.snippet.channelId;
    const title = originalVideo.snippet.title;
    
    // 키워드 추출 (제목에서 주요 단어 추출)
    const keywords = title
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3)
      .join(' ');
    
    const relatedVideos = [];
    
    // 1. 같은 채널의 다른 동영상
    const channelUrl = `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&` +
      `channelId=${channelId}&` +
      `maxResults=${Math.ceil(maxResults / 2)}&` +
      `order=relevance&` +
      `type=video&` +
      `key=${apiKey}`;
    
    const channelResponse = await fetch(channelUrl);
    if (channelResponse.ok) {
      const channelData = await channelResponse.json();
      if (channelData.items) {
        relatedVideos.push(...channelData.items.filter((item: any) => item.id.videoId !== videoId));
      }
    }
    
    // 2. 키워드 기반 검색
    if (keywords) {
      const keywordUrl = `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&` +
        `q=${encodeURIComponent(keywords)}&` +
        `maxResults=${Math.ceil(maxResults / 2)}&` +
        `order=relevance&` +
        `type=video&` +
        `key=${apiKey}`;
      
      const keywordResponse = await fetch(keywordUrl);
      if (keywordResponse.ok) {
        const keywordData = await keywordResponse.json();
        if (keywordData.items) {
          relatedVideos.push(...keywordData.items.filter((item: any) => item.id.videoId !== videoId));
        }
      }
    }
    
    // 비디오 ID 목록 추출 (중복 제거)
    const uniqueVideoIds = [...new Set(relatedVideos.map(item => item.id.videoId))];
    if (uniqueVideoIds.length === 0) {
      return { videos: [] };
    }
    
    // 상세 정보 가져오기
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
      `part=snippet,contentDetails,status&` +
      `id=${uniqueVideoIds.slice(0, maxResults).join(',')}&` +
      `key=${apiKey}`;
    
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) {
      throw new Error(`YouTube 상세정보 API 오류: ${detailsResponse.status}`);
    }
    
    const detailsData = await detailsResponse.json();
    
    // 재생 가능한 비디오만 필터링
    const videos = detailsData.items
      .filter((item: any) => {
        return item.status?.uploadStatus === 'processed' && 
               item.status?.privacyStatus === 'public' &&
               item.status?.embeddable !== false;
      })
      .map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
        publishedAt: item.snippet.publishedAt,
        duration: item.contentDetails.duration,
        description: item.snippet.description
      }));
    
    console.log(`[getRelatedVideos] 관련 영상 조회 완료: ${videos.length}개`);
    return { videos };
    
  } catch (err) {
    console.error('[getRelatedVideos] 오류 발생:', err);
    return { videos: [] };
  }
}
