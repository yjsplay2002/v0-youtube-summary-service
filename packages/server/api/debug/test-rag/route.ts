/**
 * Debug API to test RAG processing with detailed logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAndStoreVideoChunks } from '@/app/lib/rag';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { videoId, overwrite = true } = await request.json();

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId is required' },
        { status: 400 }
      );
    }

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

    // Get video data from database
    const { data: videoData, error: videoError } = await supabase
      .from('video_summaries')
      .select('dialog, video_title, summary')
      .eq('video_id', videoId)
      .single();

    if (videoError || !videoData) {
      return NextResponse.json(
        { error: 'Video not found', details: videoError },
        { status: 404 }
      );
    }

    if (!videoData.dialog) {
      return NextResponse.json(
        { error: 'No dialog data available for this video' },
        { status: 400 }
      );
    }

    console.log(`[DEBUG] Testing RAG processing for video: ${videoId}`);
    console.log(`[DEBUG] Video title: ${videoData.video_title}`);
    console.log(`[DEBUG] Dialog type: ${typeof videoData.dialog}`);
    console.log(`[DEBUG] Dialog length: ${videoData.dialog.length}`);

    // Process and store chunks with detailed logging
    const result = await processAndStoreVideoChunks(
      videoId,
      videoData.dialog,
      {
        maxTokensPerChunk: 500,
        overwriteExisting: overwrite
      }
    );

    // Get chunk statistics after processing
    const { data: chunks } = await supabase
      .from('transcript_chunks')
      .select('id, chunk_index, content, token_count, start_time, end_time')
      .eq('video_id', videoId)
      .order('chunk_index', { ascending: true });

    const stats = {
      totalChunks: chunks?.length || 0,
      avgTokensPerChunk: chunks?.length ? 
        Math.round((chunks.reduce((sum, chunk) => sum + (chunk.token_count || 0), 0)) / chunks.length) : 0,
      chunkDetails: chunks?.slice(0, 5).map(chunk => ({
        index: chunk.chunk_index,
        contentPreview: chunk.content.substring(0, 100) + '...',
        tokenCount: chunk.token_count,
        hasTimestamps: !!(chunk.start_time && chunk.end_time)
      })) || []
    };

    return NextResponse.json({
      success: result.success,
      message: result.success ? 
        `Successfully processed ${result.chunksStored} chunks` : 
        `Failed: ${result.error}`,
      chunksStored: result.chunksStored,
      videoTitle: videoData.video_title,
      stats,
      debug: {
        dialogType: typeof videoData.dialog,
        dialogLength: videoData.dialog.length,
        dialogPreview: videoData.dialog.substring(0, 500)
      }
    });

  } catch (error) {
    console.error('Error in debug test-rag endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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

    // Create supabase client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get detailed chunk information
    const { data: chunks, error } = await supabase
      .from('transcript_chunks')
      .select('*')
      .eq('video_id', videoId)
      .order('chunk_index', { ascending: true });

    if (error) {
      console.error('Error fetching chunks:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chunks', details: error },
        { status: 500 }
      );
    }

    const stats = {
      totalChunks: chunks?.length || 0,
      totalTokens: chunks?.reduce((sum, chunk) => sum + (chunk.token_count || 0), 0) || 0,
      avgTokensPerChunk: chunks?.length ? 
        Math.round((chunks.reduce((sum, chunk) => sum + (chunk.token_count || 0), 0)) / chunks.length) : 0,
      chunksWithTimestamps: chunks?.filter(chunk => chunk.start_time && chunk.end_time).length || 0,
      timeRange: chunks && chunks.length > 0 ? {
        start: Math.min(...chunks.map(c => c.start_time).filter(t => t !== null)),
        end: Math.max(...chunks.map(c => c.end_time).filter(t => t !== null))
      } : null
    };

    return NextResponse.json({
      videoId,
      stats,
      chunks: chunks?.map(chunk => ({
        id: chunk.id,
        index: chunk.chunk_index,
        contentPreview: chunk.content.substring(0, 200) + '...',
        contentLength: chunk.content.length,
        tokenCount: chunk.token_count,
        hasEmbedding: !!chunk.embedding,
        embeddingDimensions: chunk.embedding ? chunk.embedding.length : 0,
        startTime: chunk.start_time,
        endTime: chunk.end_time,
        createdAt: chunk.created_at
      })) || []
    });

  } catch (error) {
    console.error('Error in debug test-rag GET endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}