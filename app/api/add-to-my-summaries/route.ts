import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { videoId, userId } = await request.json();
    
    if (!videoId || !userId) {
      return NextResponse.json(
        { error: 'videoId and userId are required' },
        { status: 400 }
      );
    }

    console.log(`[API /add-to-my-summaries] 요청 - videoId: ${videoId}, userId: ${userId}`);

    // 1. 해당 비디오의 요약이 존재하는지 확인 (언어 무관하게 가장 최신 요약 선택)
    const { data: existingSummary } = await supabaseAdmin
      .from('video_summaries')
      .select('id, language')
      .eq('video_id', videoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!existingSummary) {
      console.log(`[API /add-to-my-summaries] 해당 비디오의 요약이 존재하지 않음`);
      return NextResponse.json(
        { success: false, error: '해당 비디오의 요약을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. 사용자가 이미 이 요약을 가지고 있는지 확인
    const { data: existingUserSummary } = await supabaseAdmin
      .from('user_summaries')
      .select('id')
      .eq('user_id', userId)
      .eq('summary_id', existingSummary.id)
      .single();

    if (existingUserSummary) {
      console.log(`[API /add-to-my-summaries] 이미 내 요약 리스트에 존재`);
      return NextResponse.json(
        { success: false, error: '이미 내 요약 리스트에 있습니다.' },
        { status: 400 }
      );
    }

    // 3. user_summaries 테이블에 관계 추가
    const { data: newUserSummary, error } = await supabaseAdmin
      .from('user_summaries')
      .insert({
        user_id: userId,
        summary_id: existingSummary.id
      })
      .select()
      .single();

    if (error) {
      console.error(`[API /add-to-my-summaries] 요약 추가 실패:`, error);
      return NextResponse.json(
        { success: false, error: '요약 추가에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log(`[API /add-to-my-summaries] 요약 추가 성공:`, newUserSummary.id);

    return NextResponse.json({
      success: true,
      message: '내 요약 리스트에 추가되었습니다.',
      userSummaryId: newUserSummary.id
    });

  } catch (error) {
    console.error('Error in add-to-my-summaries API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}