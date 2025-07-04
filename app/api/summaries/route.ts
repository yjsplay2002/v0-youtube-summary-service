import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || PAGE_SIZE.toString());
    
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
      query = query.eq('user_id', userId);
    }

    // Execute query with pagination
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching summaries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch summaries' },
        { status: 500 }
      );
    }

    // Get total count for pagination info
    let countQuery = supabaseAdmin
      .from('video_summaries')
      .select('*', { count: 'exact', head: true });
    
    // Apply user filter if provided (for authenticated users)
    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
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