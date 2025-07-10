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

    // Get all available languages for this video using the database function
    const { data: languages, error } = await supabaseAdmin
      .rpc('get_available_languages_for_video', {
        target_video_id: videoId
      });

    if (error) {
      console.error('[API /video-languages] DB 함수 호출 오류:', error);
      return NextResponse.json(
        { error: 'Failed to fetch available languages' },
        { status: 500 }
      );
    }

    console.log(`[API /video-languages] 조회 결과:`, {
      videoId,
      languageCount: languages?.length || 0,
      languages: languages?.map(l => l.language) || []
    });

    return NextResponse.json({
      videoId,
      languages: languages || [],
      meta: {
        totalLanguages: languages?.length || 0,
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