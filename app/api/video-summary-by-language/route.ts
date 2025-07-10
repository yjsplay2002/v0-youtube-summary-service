import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const language = searchParams.get('language');
    
    if (!videoId || !language) {
      return NextResponse.json(
        { error: 'videoId and language are required' },
        { status: 400 }
      );
    }

    console.log(`[API /video-summary-by-language] 요청 - videoId: ${videoId}, language: ${language}`);

    // Get summary for specific video and language using the database function
    const { data: summaryData, error } = await supabaseAdmin
      .rpc('get_video_summary_with_fallback', {
        target_video_id: videoId,
        preferred_language: language
      });

    if (error) {
      console.error('[API /video-summary-by-language] DB 함수 호출 오류:', error);
      return NextResponse.json(
        { error: 'Failed to fetch summary' },
        { status: 500 }
      );
    }

    if (!summaryData || summaryData.length === 0) {
      console.log(`[API /video-summary-by-language] 요약 없음: videoId=${videoId}, language=${language}`);
      return NextResponse.json(
        { error: 'Summary not found for this language' },
        { status: 404 }
      );
    }

    const summary = summaryData[0];
    
    console.log(`[API /video-summary-by-language] 조회 결과:`, {
      videoId,
      requestedLanguage: language,
      foundLanguage: summary.language,
      isFallback: summary.is_fallback,
      hasSummary: !!summary.summary
    });

    return NextResponse.json({
      videoId,
      requestedLanguage: language,
      foundLanguage: summary.language,
      isFallback: summary.is_fallback,
      summary: summary.summary,
      videoTitle: summary.video_title,
      channelTitle: summary.channel_title,
      createdAt: summary.created_at,
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in video-summary-by-language API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}