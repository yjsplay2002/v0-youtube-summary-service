"use server";

import { extractVideoId, fetchTranscript, getVideoDetails, type VideoDetails, type ApifyTranscriptData } from "./lib/youtube";
import { supabase, supabaseAdmin } from "@/app/lib/supabase";
import { generateSummary, formatSummaryAsMarkdown, calculateTokenCount, estimateTokensAndCost, getSystemPrompt, type AIModel, type PromptType } from "./lib/summary";
import { isUserAdmin } from "./lib/auth-utils";
import { extractVideoKeywords, extractVideoTopics } from "./lib/video-keywords";
import { extractKeywordsFromHistory } from "./lib/curation-utils";

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
  video_tags,
  video_description,
  inferred_topics,
  inferred_keywords,
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
  video_tags?: string[],
  video_description?: string,
  inferred_topics?: string[],
  inferred_keywords?: string[],
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
  promptType: PromptType = 'general_summary',
  language?: string
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

    // 8. Supabase에 저장 (게스트 사용자 우선 처리)
    try {
      if (userId) {
        // 로그인한 사용자는 개인 테이블에 저장 (dialog 필드에 Apify 전체 데이터, transcript 필드에 원본 트랜스크립트 저장)
        await upsertUserVideoSummaryToDB({
          user_id: userId,
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
          dialog: JSON.stringify(apifyRawData)  // 원본 트랜스크립트는 dialog에 포함됨
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

// 기존 dialog 데이터를 사용하여 다시 요약하는 서버 액션 (dialog 기반 재작성)
export async function resummarizeYoutubeVideo(
  videoId: string,
  aiModel: AIModel,
  userId?: string,
  promptType: PromptType = 'general_summary'
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
    const { data: userSummary, error: userError } = await supabase
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
    
    // 2-2. 레거시 요약에서 찾기 (사용자 요약에서 트랜스크립트를 찾지 못한 경우)
    if (!transcript) {
      console.log(`[resummarizeYoutubeVideo] 사용자 요약에서 트랜스크립트 없음, 레거시 요약 확인 중...`);
      
      const { data: legacySummary, error: legacyError } = await supabase
        .from('youtube_summaries')
        .select('*')
        .eq('video_id', videoId)
        .maybeSingle();
      
      console.log(`[resummarizeYoutubeVideo] 레거시 요약 조회:`, { found: !!legacySummary, hasTranscript: !!legacySummary?.transcript });
      
      if (legacySummary?.transcript) {
        if (!videoData) videoData = legacySummary;
        transcript = legacySummary.transcript;
        console.log(`[resummarizeYoutubeVideo] 레거시 요약에서 트랜스크립트 추출 성공: ${transcript.length}자`);
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
    
    const newSummary = await generateSummary(fullPrompt, aiModel);
    const markdown = formatSummaryAsMarkdown(newSummary, videoId);
    console.log(`[resummarizeYoutubeVideo] 새로운 요약 생성 완료: ${newSummary.length}자`);

    // 4. 요약 업데이트 (dialog는 그대로 유지)
    const summaryData = {
      summary: markdown,
      updated_at: new Date().toISOString()
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

// 사용자별 요약 목록 가져오기 서버 액션
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
      // 로그인한 사용자는 개인 요약 목록 조회
      console.log(`[getAllSummaries] 로그인한 사용자 요약 조회: ${userId}`);
      
      // 서버 액션에서는 supabaseAdmin 사용하여 RLS 우회
      const { data, error } = await supabaseAdmin
        .from('video_summaries')
        .select('video_id, title:video_title, thumbnail_url:video_thumbnail, channel_title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[getAllSummaries] 사용자별 DB 조회 에러:', error);
        console.error('[getAllSummaries] 에러 상세:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return [];
      }
      
      console.log(`[getAllSummaries] 로그인한 사용자(${userId}) 요약 조회 결과: ${data?.length || 0}개 레코드`);
      console.log(`[getAllSummaries] 샘플 데이터:`, data?.slice(0, 2));
      
      return data || [];
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
    console.error('[getAllSummaries] 오류 스택:', err?.stack);
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
    
    // 게스트 사용자 요약 데이터 가져오기 (user_id가 null이거나 'guest'인 데이터)
    const { data: summaries, error } = await supabase
      .from('video_summaries')
      .select('video_id, video_title, channel_title, video_thumbnail, created_at, inferred_keywords, inferred_topics')
      .or('user_id.is.null,user_id.eq.guest')
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

// 비디오 요약 존재 여부 확인
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
    
    // 게스트 요약 또는 레거시 요약 확인
    const { data: guestSummary, error: guestError } = await supabase
      .from('video_summaries')
      .select('id')
      .eq('video_id', videoId)
      .or('user_id.is.null,user_id.eq.guest')
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
