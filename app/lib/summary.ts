// app/lib/summary.ts
/**
 * AI 요약, 마크다운 변환 등 요약 관련 함수 모음
 */
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

// 시스템 프롬프트 캐시
let systemPromptCache: string | null = null;
let lastModifiedTime: number = 0;

// AI 모델 타입 정의
export type AIModel = 
  | 'openai-gpt4' 
  | 'claude-sonnet-4'
  | 'claude-3-5-sonnet' 
  | 'claude-3-5-haiku';

// Claude 모델별 설정
const CLAUDE_MODEL_CONFIG = {
  'claude-sonnet-4': {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 32000,
    temperature: 0.7
  },
  'claude-3-5-sonnet': {
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 8192,
    temperature: 0.7
  },
  'claude-3-5-haiku': {
    model: 'claude-3-5-haiku-20241022',
    maxTokens: 8192,
    temperature: 0.7
  }
} as const;

type ClaudeModel = keyof typeof CLAUDE_MODEL_CONFIG;

// OpenAI 클라이언트 초기화
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }
  return new OpenAI({ apiKey });
};

// Claude API 클라이언트 함수
const callClaudeAPI = async (systemPrompt: string, userMessage: string, model: ClaudeModel): Promise<string> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is missing');
  }

  const config = CLAUDE_MODEL_CONFIG[model];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "요약을 생성할 수 없습니다.";
};

// 시스템 프롬프트를 파일에서 읽어오는 함수 (캐싱 적용)
const getSystemPrompt = async (): Promise<string> => {
  const promptPath = path.join(process.cwd(), 'prompt.md');
  
  try {
    // 파일 상태 확인
    const stats = await fs.stat(promptPath);
    
    // 파일이 수정되었거나 캐시가 없는 경우에만 파일 읽기
    if (!systemPromptCache || stats.mtimeMs > lastModifiedTime) {
      systemPromptCache = await fs.readFile(promptPath, 'utf-8');
      lastModifiedTime = stats.mtimeMs;
      console.log(`[getSystemPrompt] 프롬프트 파일 갱신, 길이: ${systemPromptCache.length} 문자`);
    } else {
      console.log(`[getSystemPrompt] 캐시된 프롬프트 사용, 길이: ${systemPromptCache.length} 문자`);
    }
    
    if (!systemPromptCache) {
      throw new Error('프롬프트 내용이 비어 있습니다.');
    }
    
    return systemPromptCache;
  } catch (error) {
    console.error('[getSystemPrompt] 프롬프트 파일 읽기 오류:', error);
    throw new Error('시스템 프롬프트 파일을 읽을 수 없습니다.');
  }
};

// Generate summary using selected AI model
export async function generateSummary(transcript: string, model: AIModel = 'openai-gpt4'): Promise<string> {
  console.log(`[generateSummary] 사용 모델: ${model}, 입력 트랜스크립트 길이: ${transcript.length} 문자`);
  console.log(`[generateSummary] 트랜스크립트 일부: ${transcript.slice(0, 100)}...`);
  
  const systemPrompt = await getSystemPrompt();
  const userMessage = `다음은 유튜브 영상의 자막입니다. 위 지침에 따라 요약해주세요:\n\n${transcript}`;
  
  try {
    let summary: string;
    
    if (model.startsWith('claude')) {
      console.log(`[generateSummary] Claude API 요청 시작...`);
      summary = await callClaudeAPI(systemPrompt, userMessage, model as ClaudeModel);
      console.log(`[generateSummary] Claude API 응답 받음, 요약 길이: ${summary.length} 문자`);
    } else {
      console.log(`[generateSummary] OpenAI API 요청 시작...`);
      const openai = getOpenAIClient();
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // 또는 "gpt-3.5-turbo" 등 필요에 따라 모델 선택
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 30000,
      });
      
      summary = response.choices[0]?.message?.content || "요약을 생성할 수 없습니다.";
      console.log(`[generateSummary] OpenAI API 응답 받음, 요약 길이: ${summary.length} 문자`);
    }
    
    console.log(`[generateSummary] 요약 일부: ${summary.slice(0, 100)}...`);
    return summary;
  } catch (error) {
    console.error(`[generateSummary] ${model} API 오류:`, error);
    throw error;
  }
}

// Format the summary as markdown (타임스탬프를 유튜브 링크로 변환)
export function formatSummaryAsMarkdown(summary: string, videoId: string): string {
  console.log(`[formatSummaryAsMarkdown] 입력 요약 길이: ${summary.length} 문자`);

  // [hh:mm:ss] 형태의 타임스탬프를 유튜브 링크(markdown 링크)로 변환
  const timestampRegex = /\[(\d{2}):(\d{2}):(\d{2})\]/g;
  const markdown = `# YouTube 영상 요약\n\n` +
    summary.replace(timestampRegex, (match, hh, mm, ss) => {
      const seconds = parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseInt(ss, 10);
      const url = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
      return `[${hh}:${mm}:${ss}](${url})`;
    });

  console.log(`[formatSummaryAsMarkdown] 변환된 마크다운 길이: ${markdown.length} 문자`);
  return markdown;
}
