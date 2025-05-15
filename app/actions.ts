"use server";

import { extractVideoId, fetchTranscriptWithNpm, fetchTranscriptLegacy, getVideoDetails } from "./lib/youtube";
import { generateSummary, formatSummaryAsMarkdown } from "./lib/summary";

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

    // 2. 자막 가져오기 (npm 패키지 우선, 실패시 legacy)
    console.log(`[summarizeYoutubeVideo] fetchTranscriptWithNpm 시도 중...`);
    let transcript = await fetchTranscriptWithNpm(videoId);
    
    if (!transcript) {
      console.log(`[summarizeYoutubeVideo] npm 패키지로 자막 가져오기 실패, legacy 방식 시도 중...`);
      const apiKey = process.env.YOUTUBE_API_KEY || "";
      transcript = await fetchTranscriptLegacy(videoId, apiKey);
    }
    
    if (!transcript) {
      console.error(`[summarizeYoutubeVideo] 자막을 찾을 수 없음: ${videoId}`);
      return { success: false, videoId, error: "자막을 찾을 수 없습니다." };
    }
    
    console.log(`[summarizeYoutubeVideo] 자막 가져오기 성공, 길이: ${transcript.length} 문자`);

    // 3. 요약 생성
    console.log(`[summarizeYoutubeVideo] 요약 생성 시작...`);
    const summary = await generateSummary(transcript);
    const markdown = formatSummaryAsMarkdown(summary, videoId);
    
    // 4. 요약 결과 저장 및 반환
    console.log(`[summarizeYoutubeVideo] 요약 생성 완료, 길이: ${markdown.length} 문자`);
    
    // 요약 결과를 파일로 저장
    await saveSummary(videoId, markdown);
    console.log(`[summarizeYoutubeVideo] 요약 결과 저장 완료: ${videoId}`);
    
    return { success: true, videoId, summary: markdown };
  } catch (err) {
    console.error(`[summarizeYoutubeVideo] 오류 발생:`, err);
    return { success: false, error: String(err) };
  }
}

import fs from 'fs';
import path from 'path';

// 요약 결과를 파일로 저장하고 가져오기 위한 함수

// 요약 파일을 저장할 디렉토리 경로
const SUMMARIES_DIR = path.join(process.cwd(), 'summaries');

// 디렉토리가 없으면 생성
try {
  if (!fs.existsSync(SUMMARIES_DIR)) {
    fs.mkdirSync(SUMMARIES_DIR, { recursive: true });
    console.log(`[Summaries] 요약 저장용 디렉토리 생성됨: ${SUMMARIES_DIR}`);
  }
} catch (err) {
  console.error(`[Summaries] 디렉토리 생성 오류:`, err);
}

// 요약 저장 함수
export async function saveSummary(videoId: string, summary: string): Promise<void> {
  try {
    const filePath = path.join(SUMMARIES_DIR, `${videoId}.md`);
    // 비동기 파일 쓰기 사용
    await fs.promises.writeFile(filePath, summary, 'utf8');
    console.log(`[saveSummary] 요약 파일 저장 완료: ${filePath}`);
  } catch (err) {
    console.error(`[saveSummary] 파일 저장 오류:`, err);
    throw err;
  }
}

// YouTube 영상 정보 가져오기 서버 액션
export async function fetchVideoDetailsServer(videoId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is missing");
  return await getVideoDetails(videoId, apiKey);
}

// 요약 가져오기 함수
export async function getSummary(videoId: string): Promise<string | null> {
  console.log(`[getSummary] 요청 videoId: ${videoId}`);
  
  try {
    const filePath = path.join(SUMMARIES_DIR, `${videoId}.md`);
    
    // fs.existsSync는 비동기 함수가 아니지만 파일 존재 여부 확인에 사용
    if (fs.existsSync(filePath)) {
      // 비동기 파일 읽기 사용
      const summary = await fs.promises.readFile(filePath, 'utf8');
      console.log(`[getSummary] 요약 파일 찾음, 길이: ${summary.length} 문자`);
      return summary;
    } else {
      console.log(`[getSummary] 요약 파일을 찾을 수 없음: ${videoId}`);
      return null;
    }
  } catch (err) {
    console.error(`[getSummary] 파일 읽기 오류:`, err);
    return null;
  }
}
