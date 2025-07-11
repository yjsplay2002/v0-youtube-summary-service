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

    // Get summary for specific video and language WITHOUT fallback
    const { data: summaryData, error } = await supabaseAdmin
      .from('video_summaries')
      .select('id, summary, language, video_title, channel_title, created_at, user_id')
      .eq('video_id', videoId)
      .eq('language', language)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[API /video-summary-by-language] DB 조회 오류:', error);
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
      hasSummary: !!summary.summary
    });

    return NextResponse.json({
      videoId,
      requestedLanguage: language,
      foundLanguage: summary.language,
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