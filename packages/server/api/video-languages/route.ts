import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    console.log(`[API /video-languages] 요청 - videoId: ${videoId}`);

    // Get all available languages for this video
    const { data: languages, error } = await supabaseAdmin
      .from('video_summaries')
      .select(`
        language,
        created_at,
        id
      `)
      .eq('video_id', videoId);

    if (error) {
      console.error('[API /video-languages] DB 함수 호출 오류:', error);
      return NextResponse.json(
        { error: 'Failed to fetch available languages' },
        { status: 500 }
      );
    }

    // Transform data to match expected format
    const formattedLanguages = languages?.map((l: any) => ({
      language: l.language,
      created_at: l.created_at,
      summary_id: l.id
    })) || [];

    console.log(`[API /video-languages] 조회 결과:`, {
      videoId,
      languageCount: formattedLanguages.length,
      languages: formattedLanguages.map(l => l.language)
    });

    return NextResponse.json({
      videoId,
      languages: formattedLanguages,
      meta: {
        totalLanguages: formattedLanguages.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in video-languages API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}