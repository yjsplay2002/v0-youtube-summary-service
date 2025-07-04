import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Count total records in video_summaries
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('video_summaries')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({
        error: 'Failed to count records',
        details: countError
      }, { status: 500 });
    }

    // Get recent records
    const { data: recentData, error: recentError } = await supabaseAdmin
      .from('video_summaries')
      .select('video_id, video_title, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      return NextResponse.json({
        error: 'Failed to fetch recent records',
        details: recentError
      }, { status: 500 });
    }

    // Get unique users count
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('video_summaries')
      .select('user_id')
      .not('user_id', 'is', null);

    const uniqueUsers = new Set(usersData?.map(item => item.user_id) || []).size;

    return NextResponse.json({
      success: true,
      statistics: {
        totalRecords: totalCount || 0,
        uniqueUsers,
        recentRecords: recentData?.length || 0
      },
      recentData: recentData || [],
      environment: {
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV
      }
    });

  } catch (error) {
    console.error('Database debug error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}