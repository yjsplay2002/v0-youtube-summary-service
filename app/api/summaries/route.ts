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

    let query = supabaseAdmin
      .from('video_summaries')
      .select(`
        video_id,
        video_title,
        video_thumbnail,
        channel_title,
        created_at,
        user_id
      `);

    // Apply user filter if provided (for authenticated users)
    if (userId) {
      console.log('[API /summaries] 로그인 유저 쿼리:', { userId });
      query = query.eq('user_id', userId);
    } else {
      console.log('[API /summaries] 게스트 유저 쿼리 (user_id IS NULL)');
      query = query.is('user_id', null);
    }

    // Execute query with pagination
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

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
    let countQuery = supabaseAdmin
      .from('video_summaries')
      .select('*', { count: 'exact', head: true });
    
    // Apply user filter if provided (for authenticated users)
    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
    } else {
      // For unauthenticated users, count guest summaries (user_id is null)
      countQuery = countQuery.is('user_id', null);
    }
    
    const { count: totalCount } = await countQuery;

    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Transform data for frontend
    const summaries = (data || []).map(item => ({
      video_id: item.video_id,
      title: item.video_title,
      thumbnail_url: item.video_thumbnail,
      channel_title: item.channel_title,
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