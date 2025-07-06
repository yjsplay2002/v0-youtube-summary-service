import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('videoId')
    const userId = searchParams.get('userId')

    if (!videoId || !userId) {
      return NextResponse.json(
        { error: 'videoId and userId are required' },
        { status: 400 }
      )
    }

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

    // Fetch chat history from database
    const { data: chatMessages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('video_id', videoId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching chat history:', error)
      return NextResponse.json(
        { error: 'Failed to fetch chat history' },
        { status: 500 }
      )
    }

    // Transform database records to frontend format
    const messages = chatMessages?.map(msg => ({
      id: msg.id,
      type: msg.message_type,
      content: msg.content,
      timestamp: new Date(msg.created_at),
      suggested_questions: msg.suggested_questions || []
    })) || []

    return NextResponse.json({ messages })

  } catch (error) {
    console.error('Error in chat history endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    )
  }
}