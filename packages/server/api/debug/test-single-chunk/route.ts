/**
 * Debug API to test single chunk insertion
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/app/lib/embeddings';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { text = "This is a test chunk for debugging embedding storage." } = await request.json();

    console.log(`[test-single-chunk] Testing single chunk insertion...`);
    console.log(`[test-single-chunk] Text: "${text}"`);

    // Create supabase client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate embedding
    console.log(`[test-single-chunk] Generating embedding...`);
    const { embedding, tokenCount } = await generateEmbedding(text);
    console.log(`[test-single-chunk] Generated embedding: ${embedding.length} dimensions`);

    // Test different embedding formats
    const testChunk = {
      video_id: 'test-video-id',
      chunk_index: 0,
      content: text,
      start_time: null,
      end_time: null,
      token_count: tokenCount
    };

    const results = [];

    // Test 1: Raw array
    try {
      console.log(`[test-single-chunk] Test 1: Raw array format`);
      const { error: error1, data: data1 } = await supabase
        .from('transcript_chunks')
        .insert([{ ...testChunk, embedding: embedding }])
        .select('id, embedding');

      if (error1) {
        console.log(`[test-single-chunk] Test 1 failed:`, error1);
        results.push({ test: 'raw_array', success: false, error: error1.message });
      } else {
        const storedEmbedding = data1?.[0]?.embedding;
        const storedDimensions = Array.isArray(storedEmbedding) ? storedEmbedding.length : 'not array';
        console.log(`[test-single-chunk] Test 1 success: stored ${storedDimensions} dimensions`);
        results.push({ 
          test: 'raw_array', 
          success: true, 
          storedDimensions,
          originalDimensions: embedding.length,
          id: data1[0].id
        });
      }
    } catch (e) {
      console.log(`[test-single-chunk] Test 1 exception:`, e);
      results.push({ test: 'raw_array', success: false, error: e instanceof Error ? e.message : 'Exception' });
    }

    // Test 2: String format
    try {
      console.log(`[test-single-chunk] Test 2: String format`);
      const embeddingString = `[${embedding.join(',')}]`;
      const { error: error2, data: data2 } = await supabase
        .from('transcript_chunks')
        .insert([{ ...testChunk, chunk_index: 1, embedding: embeddingString }])
        .select('id, embedding');

      if (error2) {
        console.log(`[test-single-chunk] Test 2 failed:`, error2);
        results.push({ test: 'string_format', success: false, error: error2.message });
      } else {
        const storedEmbedding = data2?.[0]?.embedding;
        const storedDimensions = Array.isArray(storedEmbedding) ? storedEmbedding.length : 'not array';
        console.log(`[test-single-chunk] Test 2 success: stored ${storedDimensions} dimensions`);
        results.push({ 
          test: 'string_format', 
          success: true, 
          storedDimensions,
          originalDimensions: embedding.length,
          id: data2[0].id
        });
      }
    } catch (e) {
      console.log(`[test-single-chunk] Test 2 exception:`, e);
      results.push({ test: 'string_format', success: false, error: e instanceof Error ? e.message : 'Exception' });
    }

    // Clean up test chunks
    await supabase
      .from('transcript_chunks')
      .delete()
      .eq('video_id', 'test-video-id');

    return NextResponse.json({
      success: true,
      originalEmbedding: {
        dimensions: embedding.length,
        sampleValues: embedding.slice(0, 5)
      },
      tests: results
    });

  } catch (error) {
    console.error('[test-single-chunk] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}