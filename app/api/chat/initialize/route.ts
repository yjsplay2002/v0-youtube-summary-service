import { NextRequest, NextResponse } from 'next/server'
import { generateSummary } from '@/app/lib/summary'

export async function POST(request: NextRequest) {
  try {
    const { summary, videoId, userId } = await request.json()

    if (!summary || !videoId) {
      return NextResponse.json(
        { error: 'Summary and videoId are required' },
        { status: 400 }
      )
    }

    // Generate initial questions based on summary
    const prompt = `다음은 YouTube 비디오 요약입니다:

${summary}

이 요약을 바탕으로 사용자가 물어볼 만한 흥미로운 질문 3개를 생성해주세요. 질문은 다음 조건을 만족해야 합니다:
1. 요약 내용과 직접적으로 관련이 있어야 함
2. 구체적이고 흥미로운 질문이어야 함
3. 한 문장으로 간결하게 작성
4. 각 질문은 25자 이내로 제한

JSON 형식으로 응답해주세요:
{
  "questions": ["질문1", "질문2", "질문3"]
}`

    const aiResponse = await generateSummary(prompt, 'claude-3-5-haiku')
    
    try {
      // Try to parse as JSON
      const parsedResponse = JSON.parse(aiResponse)
      if (parsedResponse.questions && Array.isArray(parsedResponse.questions)) {
        return NextResponse.json({
          questions: parsedResponse.questions.slice(0, 3) // Ensure max 3 questions
        })
      }
    } catch (parseError) {
      // If JSON parsing fails, extract questions from text
      const questionLines = aiResponse
        .split('\n')
        .filter(line => line.trim().startsWith('1.') || line.trim().startsWith('2.') || line.trim().startsWith('3.'))
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 3)

      if (questionLines.length > 0) {
        return NextResponse.json({
          questions: questionLines
        })
      }
    }

    // Fallback questions if AI generation fails
    return NextResponse.json({
      questions: [
        "이 내용의 핵심 포인트는?",
        "실제로 어떻게 적용할 수 있을까?",
        "더 자세히 알고 싶은 부분이 있나요?"
      ]
    })

  } catch (error) {
    console.error('Error initializing chat:', error)
    return NextResponse.json(
      { error: 'Failed to initialize chat' },
      { status: 500 }
    )
  }
}