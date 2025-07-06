import { NextRequest, NextResponse } from 'next/server'
import { generateSummary } from '@/app/lib/summary'
import { createClient } from '@supabase/supabase-js'
import { getEnhancedContext } from '@/app/lib/rag'

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

    if (!message || !videoId) {
      return NextResponse.json(
        { error: 'Message and videoId are required' },
        { status: 400 }
      )
    }

    // Get enhanced context using RAG
    const { context, source, metadata } = await getEnhancedContext(message, videoId, {
      maxChunks: 3,
      maxContextLength: 2000,
      fallbackToSummary: true
    })

    // Build conversation context
    const conversationContext = conversationHistory
      ?.filter((msg: ChatMessage) => msg.type !== 'system')
      ?.map((msg: ChatMessage) => `${msg.type === 'user' ? '사용자' : 'AI'}: ${msg.content}`)
      ?.join('\n') || ''

    // Generate enhanced prompt based on context source
    let contextDescription = '';
    if (source === 'rag') {
      contextDescription = '다음은 YouTube 비디오의 관련 부분입니다:';
    } else if (source === 'summary') {
      contextDescription = '다음은 YouTube 비디오 요약입니다:';
    } else {
      contextDescription = '비디오 정보를 찾을 수 없어 일반적인 답변을 제공합니다:';
    }

    const prompt = `${contextDescription}

${context || '관련 정보가 없습니다.'}

${conversationContext ? `이전 대화 내용:
${conversationContext}

` : ''}현재 사용자 질문: ${message}

위 ${source === 'rag' ? '비디오 내용' : source === 'summary' ? '요약' : '정보'}을 바탕으로 사용자의 질문에 대해 정확하고 도움이 되는 답변을 해주세요. 
답변은 다음 조건을 만족해야 합니다:
1. 제공된 컨텍스트를 기반으로 답변
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

    const aiResponse = await generateSummary(prompt, 'gemini-2.5-flash')
    
    console.log('[chat/message] AI Response:', aiResponse)
    
    let parsedResponse: { response: string; followUpQuestions: string[] }

    try {
      // Try to parse as JSON - first attempt with full response
      let jsonText = aiResponse.trim()
      
      // If response contains markdown code blocks, extract JSON from them
      const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (jsonMatch) {
        jsonText = jsonMatch[1]
      }
      
      parsedResponse = JSON.parse(jsonText)
      if (!parsedResponse.response) {
        throw new Error('Invalid JSON structure')
      }
      console.log('[chat/message] Successfully parsed JSON response')
    } catch (parseError) {
      console.log('[chat/message] JSON parsing failed, using fallback:', parseError)
      
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
        console.log('[chat/message] Saving user message to database...', { videoId, userId, message })
        
        // Create supabase client with service role key for server-side operations
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        
        if (!supabaseServiceKey) {
          throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
        }
        
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
        
        // Save user message
        const { error: userError } = await supabase.from('chat_messages').insert({
          video_id: videoId,
          user_id: userId,
          message_type: 'user',
          content: message
        })
        
        if (userError) {
          console.error('[chat/message] Error saving user message:', userError)
          throw userError
        }

        console.log('[chat/message] Saving AI response to database...', { videoId, userId, response: parsedResponse.response })
        
        // Save AI response
        const { error: aiError } = await supabase.from('chat_messages').insert({
          video_id: videoId,
          user_id: userId,
          message_type: 'ai',
          content: parsedResponse.response,
          suggested_questions: parsedResponse.followUpQuestions
        })
        
        if (aiError) {
          console.error('[chat/message] Error saving AI response:', aiError)
          throw aiError
        }
        
        console.log('[chat/message] Successfully saved both messages to database')
      } catch (dbError) {
        console.error('Failed to save chat messages to database:', dbError)
        // Continue without throwing error - chat functionality should work even if saving fails
      }
    }

    return NextResponse.json({
      response: parsedResponse.response,
      followUpQuestions: parsedResponse.followUpQuestions?.slice(0, 3) || [],
      metadata: {
        source,
        ...(metadata || {})
      }
    })

  } catch (error) {
    console.error('Error processing chat message:', error)
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    )
  }
}