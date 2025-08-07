/**
 * Debug API to test vector search functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchRelevantChunks } from '@/app/lib/rag';

export async function POST(request: NextRequest) {
  try {
    const { 
      query = "marketing team AI agents",
      videoId = "iLtU0wQvCBU",
      threshold = 0.7,
      limit = 5 
    } = await request.json();

    console.log(`[test-vector-search] Testing vector search...`);
    console.log(`[test-vector-search] Query: "${query}"`);
    console.log(`[test-vector-search] Video ID: ${videoId}`);
    console.log(`[test-vector-search] Threshold: ${threshold}`);

    // Test vector search
    const startTime = Date.now();
    const results = await searchRelevantChunks(query, videoId, {
      limit,
      threshold,
      includeTimestamps: true
    });
    const endTime = Date.now();

    console.log(`[test-vector-search] Search completed in ${endTime - startTime}ms`);
    console.log(`[test-vector-search] Found ${results.chunks.length} chunks`);

    return NextResponse.json({
      success: true,
      query,
      videoId,
      searchParams: { threshold, limit },
      results: {
        totalChunks: results.totalChunks,
        maxSimilarity: results.maxSimilarity,
        avgSimilarity: results.avgSimilarity,
        chunks: results.chunks.map(chunk => ({
          id: chunk.id,
          similarity: chunk.similarity,
          contentPreview: chunk.content.substring(0, 200) + '...',
          contentLength: chunk.content.length,
          startTime: chunk.startTime,
          endTime: chunk.endTime
        }))
      },
      processingTime: endTime - startTime
    });

  } catch (error) {
    console.error('[test-vector-search] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to test vector search",
    example: {
      method: "POST",
      body: {
        query: "marketing team AI agents",
        videoId: "iLtU0wQvCBU",
        threshold: 0.7,
        limit: 5
      }
    }
  });
}