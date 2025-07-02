import { NextRequest, NextResponse } from 'next/server'
import { generateSummary } from '@/app/lib/summary'
import { supabase } from '@/app/lib/supabase'

interface ChatMessage {
  id: string
  type: 'user' | 'ai' | 'system'
  content: string
  timestamp: Date
  suggested_questions?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { 
      message, 
      summary, 
      videoId, 
      userId, 
      conversationHistory 
    } = await request.json()

    if (!message || !summary || !videoId) {
      return NextResponse.json(
        { error: 'Message, summary, and videoId are required' },
        { status: 400 }
      )
    }

    // Build conversation context
    const conversationContext = conversationHistory
      ?.filter((msg: ChatMessage) => msg.type !== 'system')
      ?.map((msg: ChatMessage) => `${msg.type === 'user' ? '사용자' : 'AI'}: ${msg.content}`)
      ?.join('\n') || ''

    // Generate AI response
    const prompt = `다음은 YouTube 비디오 요약입니다:

${summary}

${conversationContext ? `이전 대화 내용:
${conversationContext}

` : ''}현재 사용자 질문: ${message}

위 요약을 바탕으로 사용자의 질문에 대해 정확하고 도움이 되는 답변을 해주세요. 
답변은 다음 조건을 만족해야 합니다:
1. 요약 내용을 기반으로 답변
2. 구체적이고 실용적인 정보 제공
3. 자연스럽고 친근한 톤 사용
4. 200자 이내로 간결하게 작성

그리고 이 답변과 관련하여 사용자가 추가로 궁금해할 만한 후속 질문 3개를 생성해주세요.
후속 질문은 각각 25자 이내로 제한하고, 답변과 직접 관련이 있어야 합니다.

JSON 형식으로 응답해주세요:
{
  "response": "AI 답변",
  "followUpQuestions": ["후속질문1", "후속질문2", "후속질문3"]
}`

    const aiResponse = await generateSummary(prompt, 'claude-3-5-haiku')
    
    let parsedResponse: { response: string; followUpQuestions: string[] }

    try {
      // Try to parse as JSON
      parsedResponse = JSON.parse(aiResponse)
      if (!parsedResponse.response) {
        throw new Error('Invalid JSON structure')
      }
    } catch (parseError) {
      // If JSON parsing fails, use the entire response as answer
      parsedResponse = {
        response: aiResponse,
        followUpQuestions: [
          "더 구체적인 예시가 있나요?",
          "이와 관련된 다른 정보는?",
          "실제 적용 방법이 궁금해요"
        ]
      }
    }

    // Save conversation to database if user is logged in
    if (userId) {
      try {
        // Save user message
        await supabase.from('chat_messages').insert({
          video_id: videoId,
          user_id: userId,
          message_type: 'user',
          content: message,
          created_at: new Date().toISOString()
        })

        // Save AI response
        await supabase.from('chat_messages').insert({
          video_id: videoId,
          user_id: userId,
          message_type: 'ai',
          content: parsedResponse.response,
          suggested_questions: parsedResponse.followUpQuestions,
          created_at: new Date().toISOString()
        })
      } catch (dbError) {
        console.error('Failed to save chat messages to database:', dbError)
        // Continue without throwing error - chat functionality should work even if saving fails
      }
    }

    return NextResponse.json({
      response: parsedResponse.response,
      followUpQuestions: parsedResponse.followUpQuestions?.slice(0, 3) || []
    })

  } catch (error) {
    console.error('Error processing chat message:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}