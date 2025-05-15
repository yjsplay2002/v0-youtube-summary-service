// app/lib/summary.ts
/**
 * AI 요약, 마크다운 변환 등 요약 관련 함수 모음
 */
import OpenAI from 'openai';

// OpenAI 클라이언트 초기화
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }
  return new OpenAI({ apiKey });
};

// 시스템 프롬프트 정의
const SYSTEM_PROMPT = `
당신은 최고의 유튜브 영상 요약 전문가입니다.
아래 지침을 반드시 지켜서 자막을 요약하세요:

1. 영상의 전체 맥락, 주요 장면, 논리적 흐름, 인상적인 발언, 실질적 배운점, 숨겨진 인사이트까지 최대한 상세하고 길게 요약하세요.
2. 각 핵심 내용별로 반드시 타임스탬프([00:12:34])를 포함하고, 해당 구간에서 중요한 내용을 **최소 4~6문장 이상**으로 깊이 있게 서술하세요.
3. 영상의 모든 주요 흐름과 세부 장면, 논리적 전개, 배경 맥락, 인상적인 발언, 등장인물의 감정 변화까지 빠짐없이 포함하세요.
4. 요약은 마크다운 카드(카테고리, 타임스탬프, 내용) 형태로 구조화하세요.
5. 각 타임스탬프별 요약이 충분히 상세하고, 영상의 흐름을 따라가도록 작성하세요.
6. 요약 마지막에는 전체 영상의 핵심 메시지와 느낀점, 시청자가 얻을 수 있는 실질적 배운점을 한 문단 이상으로 충분히 길게 정리하세요.
7. 불필요한 반복, 잡음, 사족은 생략하세요.
8. 타임스탬프는 반드시 [hh:mm:ss] 형식으로 표기하세요.

예시 포맷:

📍 **주제/카테고리**
🕒 [00:04:12]
- 주요 내용 1 (4~6문장 이상)
- 주요 내용 2 (4~6문장 이상)

---
🔹 핵심 요점:  
- [포인트 1]  
- [포인트 2]  
- [포인트 3]  
---

4. 말투는 진지하지만 이해하기 쉬운 어조로 써줘. 가능한 한 감정적 몰입 요소도 추가해줘 (예: "그녀는 처음으로 자아와 욕실 벽의 경계를 구분할 수 없는 상태에 빠졌다." 등).

내용이 학술적인 경우에는 최대한 학술적인 톤으로 요약하고, 캐주얼한 내용은 캐주얼한 톤으로 요약해주세요.`;

// Generate summary using OpenAI API
export async function generateSummary(transcript: string): Promise<string> {
  console.log(`[generateSummary] 입력 트랜스크립트 길이: ${transcript.length} 문자`);
  console.log(`[generateSummary] 트랜스크립트 일부: ${transcript.slice(0, 100)}...`);
  
  try {
    const openai = getOpenAIClient();
    
    console.log(`[generateSummary] OpenAI API 요청 시작...`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // 또는 "gpt-3.5-turbo" 등 필요에 따라 모델 선택
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `다음은 유튜브 영상의 자막입니다. 위 지침에 따라 요약해주세요:\n\n${transcript}` }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });
    
    const summary = response.choices[0]?.message?.content || "요약을 생성할 수 없습니다.";
    console.log(`[generateSummary] OpenAI API 응답 받음, 요약 길이: ${summary.length} 문자`);
    console.log(`[generateSummary] 요약 일부: ${summary.slice(0, 100)}...`);
    
    return summary;
  } catch (error) {
    console.error(`[generateSummary] OpenAI API 오류:`, error);
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

