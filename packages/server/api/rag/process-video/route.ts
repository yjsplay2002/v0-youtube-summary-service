/**
 * API endpoint to process video dialog and generate embeddings
 * This endpoint should be called after video summarization to prepare RAG data
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAndStoreVideoChunks } from '@/app/lib/rag';
import { supabaseAdmin } from '@/app/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { videoId, userId, overwrite = false } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

    // Get video data from database
    const { data: videoData, error: videoError } = await supabaseAdmin
      .from('video_summaries')
      .select('dialog, video_title')
      .eq('video_id', videoId)
      .single();

    if (videoError || !videoData) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    if (!videoData.dialog) {
      return NextResponse.json(
        { error: 'No dialog data available for this video' },
        { status: 400 }
      );
    }

    // Process and store chunks
    const result = await processAndStoreVideoChunks(
      videoId,
      videoData.dialog,
      {
        maxTokensPerChunk: 500,
        overwriteExisting: overwrite
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process video chunks' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${result.chunksStored} chunks for video`,
      chunksStored: result.chunksStored,
      videoTitle: videoData.video_title
    });

  } catch (error) {
    console.error('Error in process-video endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId parameter is required' },
        { status: 400 }
      );
    }

    // Get chunk statistics for the video
    const { data: chunks, error } = await supabaseAdmin
      .from('transcript_chunks')
      .select('id, token_count, start_time, end_time, created_at')
      .eq('video_id', videoId);

    if (error) {
      console.error('Error fetching chunk stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chunk statistics' },
        { status: 500 }
      );
    }

    const totalChunks = chunks?.length || 0;
    const totalTokens = chunks?.reduce((sum, chunk) => sum + (chunk.token_count || 0), 0) || 0;
    const timeRange = chunks && chunks.length > 0 ? {
      start: Math.min(...chunks.map(c => c.start_time).filter(t => t !== null)),
      end: Math.max(...chunks.map(c => c.end_time).filter(t => t !== null))
    } : null;

    return NextResponse.json({
      videoId,
      totalChunks,
      totalTokens,
      avgTokensPerChunk: totalChunks > 0 ? Math.round(totalTokens / totalChunks) : 0,
      timeRange,
      lastProcessed: chunks && chunks.length > 0 ? chunks[0].created_at : null
    });

  } catch (error) {
    console.error('Error in process-video GET endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}