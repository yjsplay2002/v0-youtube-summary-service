/**
 * Debug API to clear all transcript chunks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();

    // Create supabase client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseServiceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get count before deletion
    const { data: beforeCount } = await supabase
      .from('transcript_chunks')
      .select('id', { count: 'exact' })
      .eq('video_id', videoId);

    console.log(`[clear-chunks] Found ${beforeCount?.length || 0} chunks for video ${videoId}`);

    // Delete chunks for this video
    const { error: deleteError } = await supabase
      .from('transcript_chunks')
      .delete()
      .eq('video_id', videoId);

    if (deleteError) {
      console.error('[clear-chunks] Error deleting chunks:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete chunks', details: deleteError },
        { status: 500 }
      );
    }

    // Verify deletion
    const { data: afterCount } = await supabase
      .from('transcript_chunks')
      .select('id', { count: 'exact' })
      .eq('video_id', videoId);

    console.log(`[clear-chunks] Remaining chunks after deletion: ${afterCount?.length || 0}`);

    return NextResponse.json({
      success: true,
      message: `Deleted ${beforeCount?.length || 0} chunks for video ${videoId}`,
      deletedCount: beforeCount?.length || 0,
      remainingCount: afterCount?.length || 0
    });

  } catch (error) {
    console.error('[clear-chunks] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Create supabase client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get total count before deletion
    const { data: beforeCount } = await supabase
      .from('transcript_chunks')
      .select('id', { count: 'exact' });

    console.log(`[clear-chunks] Found ${beforeCount?.length || 0} total chunks`);

    // Delete ALL chunks
    const { error: deleteError } = await supabase
      .from('transcript_chunks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (dummy condition)

    if (deleteError) {
      console.error('[clear-chunks] Error deleting all chunks:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete all chunks', details: deleteError },
        { status: 500 }
      );
    }

    // Verify deletion
    const { data: afterCount } = await supabase
      .from('transcript_chunks')
      .select('id', { count: 'exact' });

    console.log(`[clear-chunks] Remaining chunks after deletion: ${afterCount?.length || 0}`);

    return NextResponse.json({
      success: true,
      message: `Deleted all ${beforeCount?.length || 0} chunks from database`,
      deletedCount: beforeCount?.length || 0,
      remainingCount: afterCount?.length || 0
    });

  } catch (error) {
    console.error('[clear-chunks] Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}