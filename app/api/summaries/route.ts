import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || PAGE_SIZE.toString());
    
    console.log('[API /summaries] 요청 수신:', {
      userId,
      page,
      limit,
      isGuestUser: !userId,
      url: request.url
    });
    
    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

    let data, error;

    if (userId) {
      console.log('[API /summaries] 로그인 유저 쿼리 (새로운 구조 시도):', { userId });
      
      // Try new structure first: user_summaries -> video_summaries
      try {
        const { data: newStructureData, error: newStructureError } = await supabaseAdmin
          .from('user_summaries')
          .select(`
            created_at,
            video_summaries!inner(
              video_id,
              video_title,
              video_thumbnail,
              channel_title,
              language
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (newStructureError) {
          throw newStructureError;
        }

        // Transform new structure data
        data = newStructureData?.map(item => ({
          video_id: item.video_summaries.video_id,
          video_title: item.video_summaries.video_title,
          video_thumbnail: item.video_summaries.video_thumbnail,
          channel_title: item.video_summaries.channel_title,
          language: item.video_summaries.language,
          created_at: item.created_at,
          user_id: userId
        })) || [];

        console.log('[API /summaries] 새로운 구조 쿼리 성공:', { resultCount: data.length });
        
      } catch (newStructureError) {
        console.log('[API /summaries] 새로운 구조 실패, 기존 구조로 폴백:', newStructureError);
        
        // Fallback to old structure: direct user_id in video_summaries
        const { data: oldStructureData, error: oldStructureError } = await supabaseAdmin
          .from('video_summaries')
          .select(`
            video_id,
            video_title,
            video_thumbnail,
            channel_title,
            language,
            created_at,
            user_id
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        data = oldStructureData;
        error = oldStructureError;
        
        console.log('[API /summaries] 기존 구조 쿼리 결과:', { resultCount: data?.length || 0 });
      }
    } else {
      console.log('[API /summaries] 게스트 유저 쿼리 (user_id IS NULL)');
      
      // For guests, use video_summaries with user_id IS NULL
      const { data: guestData, error: guestError } = await supabaseAdmin
        .from('video_summaries')
        .select(`
          video_id,
          video_title,
          video_thumbnail,
          channel_title,
          language,
          created_at,
          user_id
        `)
        .is('user_id', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      data = guestData;
      error = guestError;
    }

    if (error) {
      console.error('[API /summaries] DB 쿼리 에러:', error);
      return NextResponse.json(
        { error: 'Failed to fetch summaries' },
        { status: 500 }
      );
    }
    
    console.log('[API /summaries] DB 쿼리 결과:', {
      resultCount: data?.length || 0,
      isGuestQuery: !userId,
      sampleData: data?.slice(0, 2)
    });

    // Get total count for pagination info
    let totalCount = 0;
    
    if (userId) {
      // Try to get count from new structure first
      try {
        const { count: newStructureCount } = await supabaseAdmin
          .from('user_summaries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        
        totalCount = newStructureCount || 0;
        console.log('[API /summaries] 새로운 구조 카운트:', totalCount);
        
      } catch (countError) {
        console.log('[API /summaries] 새로운 구조 카운트 실패, 기존 구조로 폴백');
        
        // Fallback to old structure count
        const { count: oldStructureCount } = await supabaseAdmin
          .from('video_summaries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        
        totalCount = oldStructureCount || 0;
        console.log('[API /summaries] 기존 구조 카운트:', totalCount);
      }
    } else {
      // For guests, count video_summaries with user_id IS NULL
      const { count: guestCount } = await supabaseAdmin
        .from('video_summaries')
        .select('*', { count: 'exact', head: true })
        .is('user_id', null);
      
      totalCount = guestCount || 0;
      console.log('[API /summaries] 게스트 카운트:', totalCount);
    }

    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Transform data for frontend
    const summaries = (data || []).map(item => ({
      video_id: item.video_id,
      title: item.video_title || item.video_summaries?.video_title,
      thumbnail_url: item.video_thumbnail || item.video_summaries?.video_thumbnail,
      channel_title: item.channel_title || item.video_summaries?.channel_title,
      language: item.language || item.video_summaries?.language || 'en',
      created_at: item.created_at,
      // Don't expose user_id in public responses
      ...(userId && { user_id: item.user_id })
    }));

    return NextResponse.json({
      summaries,
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
        totalPages,
        hasNextPage,
        hasPreviousPage
      },
      meta: {
        userSpecific: !!userId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in summaries API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}