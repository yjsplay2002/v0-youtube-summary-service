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
✅ 유튜브 영상 요약 프롬프트 (카드형 단락 구분 버전)

당신은 유튜브 요약 전문가입니다.
다음 지침에 따라 콘텐츠 성격에 따라 자동 분류하고, 아래 형식처럼 시각적으로 명확히 구분된 카드 형태로 정리하세요.

⸻

📍 콘텐츠 유형 자동 분류 및 분기 처리
	1.	먼저 자막 내용을 분석하여 아래 중 가장 적절한 콘텐츠 유형을 하나 선택합니다:
	•	🎓 학술자료 (지식, 개념 중심)
	•	🧰 튜토리얼 (사용법, 과정 중심)
	•	📰 정보성 콘텐츠 (스토리, 인터뷰, 리뷰 중심)
	2.	유형에 따라 다음 스타일 가이드라인을 적용해 요약하세요.

⸻

🧾 출력 형식 (이미지 스타일 기반)

각 단락은 다음과 같은 구조로 명확히 구분된 카드 스타일로 출력하세요:

1. 🗂️ [섹션 제목]  
⏱️ [00:00:46]

• [요점 1: 최소 2~3문장]  
• [요점 2: 맥락 설명 or 발언 강조]  
• [요점 3: 인상적이거나 중요한 추가 정보]  
...

	문단은 번호로 구분되고, 각 문단에 해당하는 타임스탬프와 제목을 명시하세요.
각 요점은 문단 하나로 충분히 정보를 담되, **요약이라기보단 “정리된 내용 전달”**을 목표로 합니다.

⸻

🧠 콘텐츠 유형별 스타일 지침

🎓 학술자료
	•	정제된 문체, 개념 설명에 중점
	•	이론/정의/인용 강조
	•	복잡한 문장은 간결히 재구성

🧰 튜토리얼
	•	단계별 설명, 실습 흐름 강조
	•	주의사항, 팁도 포함
	•	따라할 수 있게 명확하고 쉬운 문체

📰 정보성 콘텐츠
	•	흐름과 분위기 전달
	•	인물, 상황, 맥락 강조
	•	감정 묘사나 에피소드도 포함

⸻

🏁 마지막 문단 예시

📌 전체 메시지 및 느낀 점  

> 이 영상은 일반인의 지식 확장을 위해 옴시디언을 어떻게 활용할 수 있는지를 실제 사례를 통해 설득력 있게 보여준다. 특히 호스트와 게스트 간의 자연스러운 대화에서 중요한 개념들이 흘러나오는 방식은 시청자에게 친숙하면서도 인사이트 있는 시청 경험을 제공한다.



⸻

`;

// Generate summary using OpenAI API
export async function generateSummary(transcript: string): Promise<string> {
  console.log(`[generateSummary] 입력 트랜스크립트 길이: ${transcript.length} 문자`);
  console.log(`[generateSummary] 트랜스크립트 일부: ${transcript.slice(0, 100)}...`);
  
  try {
    const openai = getOpenAIClient();
    
    console.log(`[generateSummary] OpenAI API 요청 시작...`);
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano", // 또는 "gpt-3.5-turbo" 등 필요에 따라 모델 선택
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `다음은 유튜브 영상의 자막입니다. 위 지침에 따라 요약해주세요:\n\n${transcript}` }
      ],
      temperature: 0.7,
      max_tokens: 30000,
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

