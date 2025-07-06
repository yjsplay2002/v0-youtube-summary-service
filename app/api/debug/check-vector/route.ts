/**
 * Debug API to check vector data in database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId') || 'iLtU0wQvCBU';

    // Create supabase client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get chunk data with embedding info
    const { data: chunks, error } = await supabase
      .from('transcript_chunks')
      .select('id, video_id, chunk_index, content, embedding')
      .eq('video_id', videoId)
      .limit(3);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const analysis = chunks?.map(chunk => {
      const embedding = chunk.embedding;
      
      return {
        id: chunk.id,
        chunkIndex: chunk.chunk_index,
        contentPreview: chunk.content.substring(0, 100) + '...',
        embedding: {
          type: typeof embedding,
          isArray: Array.isArray(embedding),
          isString: typeof embedding === 'string',
          length: typeof embedding === 'string' ? embedding.length : 
                  Array.isArray(embedding) ? embedding.length : 'unknown',
          preview: typeof embedding === 'string' ? embedding.substring(0, 100) + '...' :
                   Array.isArray(embedding) ? embedding.slice(0, 5) : 'not accessible'
        }
      };
    }) || [];

    // Try to use SQL to get vector dimensions
    try {
      const { data: sqlResult } = await supabase
        .rpc('get_vector_info', { video_id_param: videoId });
        
      return NextResponse.json({
        chunks: analysis,
        sqlResult: sqlResult || 'No SQL result'
      });
    } catch (sqlError) {
      // If SQL function doesn't exist, return without it
      return NextResponse.json({
        chunks: analysis,
        sqlError: 'SQL function not available'
      });
    }

  } catch (error) {
    console.error('[check-vector] Error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}