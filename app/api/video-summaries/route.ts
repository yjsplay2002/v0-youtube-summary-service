import { NextRequest, NextResponse } from 'next/server';
import { getAllVideoSummaries } from '@/app/actions';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const userId = searchParams.get('userId');
    
    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    console.log(`[API /video-summaries] 요청 - videoId: ${videoId}, userId: ${userId || 'anonymous'}`);

    // 모든 요약 결과 조회
    const summariesResult = await getAllVideoSummaries(videoId, userId || undefined);

    console.log(`[API /video-summaries] 조회 결과:`, {
      videoId,
      hasMySummary: !!summariesResult.mySummary,
      otherSummariesCount: summariesResult.otherSummaries.length,
      totalSummaries: summariesResult.totalSummaries
    });

    // 응답 데이터 구성
    const response = {
      videoId,
      mySummary: summariesResult.mySummary ? {
        summary: summariesResult.mySummary.summary,
        created_at: summariesResult.mySummary.created_at,
        isMine: true
      } : null,
      otherSummaries: summariesResult.otherSummaries.map((summary, index) => ({
        summary: summary.summary,
        created_at: summary.created_at,
        isGuest: summary.isGuest,
        isMine: false,
        order: index + 1 // 최신순으로 정렬된 순서
      })),
      totalSummaries: summariesResult.totalSummaries,
      meta: {
        hasMultipleSummaries: summariesResult.totalSummaries > 1,
        canUseExistingSummary: summariesResult.otherSummaries.length > 0,
        userSpecific: !!userId,
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in video-summaries API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}