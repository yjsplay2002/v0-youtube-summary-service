// app/lib/summary.ts
/**
 * AI 요약, 마크다운 변환 등 요약 관련 함수 모음
 */
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import { supabase } from './supabase';
import { encoding_for_model } from 'tiktoken';

// 시스템 프롬프트 캐시
let systemPromptCache: string | null = null;
let lastModifiedTime: number = 0;

// AI 모델 타입 정의
export type AIModel = 
  | 'openai-gpt4' 
  | 'claude-sonnet-4'
  | 'claude-3-5-sonnet' 
  | 'claude-3-5-haiku';

// 프롬프트 타입 정의
export type PromptType = 'general_summary' | 'discussion_format';


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

// 토큰 수 계산 함수
export function calculateTokenCount(text: string, model: AIModel = 'claude-3-5-haiku'): number {
  try {
    if (model.startsWith('claude')) {
      // Claude 모델의 경우 대략적인 토큰 수 계산 (1 토큰 ≈ 4 문자)
      return Math.ceil(text.length / 3.5);
    } else {
      // OpenAI 모델의 경우 tiktoken 사용
      const encoder = encoding_for_model('gpt-4');
      const tokens = encoder.encode(text);
      encoder.free();
      return tokens.length;
    }
  } catch (error) {
    console.warn('[calculateTokenCount] 토큰 계산 중 오류:', error);
    // 오류 발생 시 대략적인 계산으로 fallback
    return Math.ceil(text.length / 4);
  }
}

// 토큰 수 및 예상 비용 계산 함수
export function estimateTokensAndCost(
  systemPrompt: string, 
  userMessage: string, 
  model: AIModel = 'claude-3-5-haiku'
): { inputTokens: number; estimatedOutputTokens: number; estimatedCostUSD: number } {
  const inputTokens = calculateTokenCount(systemPrompt + userMessage, model);
  const estimatedOutputTokens = Math.min(8192, Math.ceil(inputTokens * 0.3)); // 출력은 입력의 약 30%로 추정
  
  // 모델별 비용 (1M 토큰당 USD)
  const costs = {
    'claude-sonnet-4': { input: 15, output: 75 },
    'claude-3-5-sonnet': { input: 3, output: 15 },
    'claude-3-5-haiku': { input: 0.25, output: 1.25 },
    'openai-gpt4': { input: 10, output: 30 }
  };
  
  const cost = costs[model] || costs['claude-3-5-sonnet'];
  const estimatedCostUSD = (inputTokens * cost.input + estimatedOutputTokens * cost.output) / 1000000;
  
  return {
    inputTokens,
    estimatedOutputTokens,
    estimatedCostUSD: Math.round(estimatedCostUSD * 1000) / 1000 // 소수점 3자리까지
  };
}

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
    if (response.status === 529) {
      console.warn('[callClaudeAPI] Claude API is overloaded (529).');
      throw new Error('Claude API server is busy now (529 overloaded)');
    }
    const errorText = await response.text();
    console.error('[callClaudeAPI] Claude API 요청 중 오류 발생:', response.status, errorText);
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "요약을 생성할 수 없습니다.";
};

// 기본 시스템 프롬프트 (fallback)
const DEFAULT_SYSTEM_PROMPT = `역할
당신은 유튜브 영상 내용을 구조화된 형식으로 요약하는 전문가입니다.

요약 형식 구조
1. 📌 핵심 질문과 답변 (상단)
- 영상의 메인 주제를 질문 형태로 제시
- 핵심 답변을 간결하게 제공

2. 💡 세부 내용 질문과 답변
- 핵심 내용의 구체적인 방법이나 세부사항을 질문 형태로 제시
- 각 항목을 * 기호로 나열하여 상세 설명

3. 목차
- 영상의 주요 섹션을 5-7개 항목으로 구성
- 각 항목에 적절한 이모지 추가 (💡, 💰, 🛠️, 📊 등)

4. 전체 요약 (200-300자)
- 영상의 전반적인 내용과 목적을 한 문단으로 요약
- 중요 키워드는 굵은 글씨로 강조
- 영상이 다루는 핵심 문제와 해결책을 명확히 제시

5. 핵심 용어
- 영상에서 언급되는 주요 전문용어 2-3개 선정
- 각 용어에 대한 쉬운 설명 제공 (일반인도 이해할 수 있도록)

6. 상세 내용 분석
각 목차 항목에 대해 다음과 같이 구성:
- 섹션 번호. 이모지 섹션 제목
- 해당 섹션의 핵심 내용을 3-5개 불릿 포인트로 정리
- 구체적인 수치나 예시가 있다면 반드시 포함
- 중요한 개념은 굵은 글씨로 강조

작성 가이드라인
- 이모지 활용: 각 섹션과 핵심 내용에 적절한 이모지 사용
- 키워드 강조: 중요한 용어와 개념은 굵은 글씨로 표시
- 구체적 정보: 수치, 예시, 구체적인 방법론 포함
- 구조화: 명확한 계층 구조와 일관된 형식 유지
- 완전성: 영상의 모든 주요 내용을 빠짐없이 포함

위 형식을 정확히 따라 유튜브 영상을 요약해주세요.`;

// 데이터베이스에서 시스템 프롬프트를 가져오는 함수
const getSystemPromptFromDB = async (promptType: PromptType = 'general_summary'): Promise<string> => {
  try {
    console.log(`[getSystemPromptFromDB] 프롬프트 타입: ${promptType}`);
    
    const { data, error } = await supabase
      .from('system_prompts')
      .select('prompt_content')
      .eq('prompt_type', promptType)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('[getSystemPromptFromDB] DB 조회 오류:', error);
      throw error;
    }
    
    if (!data || !data.prompt_content) {
      console.warn(`[getSystemPromptFromDB] 프롬프트 타입 '${promptType}'에 대한 데이터가 없음`);
      throw new Error(`프롬프트 타입 '${promptType}'을 찾을 수 없습니다.`);
    }
    
    console.log(`[getSystemPromptFromDB] 성공, 프롬프트 길이: ${data.prompt_content.length} 문자`);
    return data.prompt_content;
  } catch (error) {
    console.error('[getSystemPromptFromDB] 오류:', error);
    throw error;
  }
};

// 시스템 프롬프트를 파일에서 읽어오는 함수 (캐싱 적용) - 레거시 지원
const getSystemPromptFromFile = async (): Promise<string> => {
  const promptPath = path.join(process.cwd(), 'prompt.md');
  
  try {
    // 파일 상태 확인
    const stats = await fs.stat(promptPath);
    
    // 파일이 수정되었거나 캐시가 없는 경우에만 파일 읽기
    if (!systemPromptCache || stats.mtimeMs > lastModifiedTime) {
      const fileContent = await fs.readFile(promptPath, 'utf-8');
      
      // 파일 내용이 비어있지 않은지 확인
      if (fileContent && fileContent.trim().length > 0) {
        systemPromptCache = fileContent;
        lastModifiedTime = stats.mtimeMs;
        console.log(`[getSystemPrompt] 프롬프트 파일 갱신, 길이: ${systemPromptCache.length} 문자`);
      } else {
        console.warn('[getSystemPrompt] 프롬프트 파일이 비어있음, 기본 프롬프트 사용');
        systemPromptCache = DEFAULT_SYSTEM_PROMPT;
      }
    } else {
      console.log(`[getSystemPrompt] 캐시된 프롬프트 사용, 길이: ${systemPromptCache.length} 문자`);
    }
    
    return systemPromptCache;
  } catch (error) {
    console.error('[getSystemPrompt] 프롬프트 파일 읽기 오류:', error);
    console.log('[getSystemPrompt] 기본 프롬프트를 사용합니다');
    
    // 파일 읽기 실패 시 기본 프롬프트 사용
    if (!systemPromptCache) {
      systemPromptCache = DEFAULT_SYSTEM_PROMPT;
    }
    
    return systemPromptCache;
  }
};

// 통합 시스템 프롬프트 가져오기 함수 (DB 우선, 파일 fallback)
const getSystemPrompt = async (promptType: PromptType = 'general_summary'): Promise<string> => {
  try {
    // 1. 데이터베이스에서 프롬프트 가져오기 시도
    console.log(`[getSystemPrompt] DB에서 프롬프트 가져오기 시도: ${promptType}`);
    return await getSystemPromptFromDB(promptType);
  } catch (dbError) {
    console.warn('[getSystemPrompt] DB에서 프롬프트 가져오기 실패, 파일 시스템 시도:', dbError);
    
    try {
      // 2. 파일에서 프롬프트 가져오기 시도 (레거시 지원)
      console.log('[getSystemPrompt] 파일에서 프롬프트 가져오기 시도');
      return await getSystemPromptFromFile();
    } catch (fileError) {
      console.warn('[getSystemPrompt] 파일에서 프롬프트 가져오기 실패, 기본 프롬프트 사용:', fileError);
      
      // 3. 기본 프롬프트 사용 (최종 fallback)
      console.log('[getSystemPrompt] 기본 프롬프트 사용');
      return DEFAULT_SYSTEM_PROMPT;
    }
  }
};

// Generate summary using selected AI model
export async function generateSummary(
  transcript: string, 
  model: AIModel = 'claude-3-5-haiku', 
  summaryPrompt?: string,
  promptType: PromptType = 'general_summary'
): Promise<string> {
  console.log(`[generateSummary] 사용 모델: ${model}, 프롬프트 타입: ${promptType}, 입력 트랜스크립트 길이: ${transcript.length} 문자`);
  console.log(`[generateSummary] 트랜스크립트 일부: ${transcript.slice(0, 100)}...`);
  
  const systemPrompt = await getSystemPrompt(promptType);
  let userMessage = '';
  
  if (summaryPrompt) {
    console.log(`[generateSummary] 커스텀 요약 프롬프트 사용: ${summaryPrompt.slice(0, 50)}...`);
    userMessage = `다음은 유튜브 영상의 자막입니다. 위 지침에 따라 요약해주세요.\n\n요약 지침: ${summaryPrompt}\n\n자막 내용:\n${transcript}`;
  } else {
    userMessage = `다음은 유튜브 영상의 자막입니다. 위 지침에 따라 요약해주세요:\n\n${transcript}`;
  }
  
  // 토큰 수 및 예상 비용 계산
  const tokenEstimate = estimateTokensAndCost(systemPrompt, userMessage, model);
  console.log(`[generateSummary] 토큰 분석:`, {
    입력토큰: tokenEstimate.inputTokens,
    예상출력토큰: tokenEstimate.estimatedOutputTokens,
    예상비용USD: `$${tokenEstimate.estimatedCostUSD}`,
    시스템프롬프트길이: systemPrompt.length,
    사용자메시지길이: userMessage.length
  });
  
  // 토큰 수가 너무 많은 경우 경고
  if (tokenEstimate.inputTokens > 150000) {
    console.warn(`[generateSummary] ⚠️  입력 토큰이 매우 많습니다 (${tokenEstimate.inputTokens} 토큰). 모델 한계를 초과할 수 있습니다.`);
  } else if (tokenEstimate.inputTokens > 100000) {
    console.log(`[generateSummary] 📊 큰 입력 토큰 (${tokenEstimate.inputTokens} 토큰). 처리 시간이 오래 걸릴 수 있습니다.`);
  }
  
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
    summary.replace(timestampRegex, (_, hh, mm, ss) => {
      const seconds = parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseInt(ss, 10);
      const url = `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
      return `[${hh}:${mm}:${ss}](${url})`;
    });

  console.log(`[formatSummaryAsMarkdown] 변환된 마크다운 길이: ${markdown.length} 문자`);
  return markdown;
}
