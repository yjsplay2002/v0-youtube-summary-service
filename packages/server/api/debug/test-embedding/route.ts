/**
 * Debug API to test embedding generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/app/lib/embeddings';

export async function POST(request: NextRequest) {
  try {
    const { text = "This is a test text for embedding generation." } = await request.json();

    console.log(`[test-embedding] Testing embedding generation for text: "${text.substring(0, 100)}..."`);
    console.log(`[test-embedding] Text length: ${text.length}`);

    // Generate embedding
    const startTime = Date.now();
    const result = await generateEmbedding(text);
    const endTime = Date.now();

    console.log(`[test-embedding] Embedding generation completed in ${endTime - startTime}ms`);
    console.log(`[test-embedding] Embedding dimensions: ${result.embedding.length}`);
    console.log(`[test-embedding] Token count: ${result.tokenCount}`);
    console.log(`[test-embedding] First 10 values:`, result.embedding.slice(0, 10));
    console.log(`[test-embedding] Last 10 values:`, result.embedding.slice(-10));

    // Additional validation
    const isValidArray = Array.isArray(result.embedding);
    const hasCorrectLength = result.embedding.length === 1536;
    const allNumbers = result.embedding.every(val => typeof val === 'number' && !isNaN(val));
    const hasValidRange = result.embedding.every(val => val >= -1 && val <= 1);

    return NextResponse.json({
      success: true,
      textLength: text.length,
      tokenCount: result.tokenCount,
      embedding: {
        dimensions: result.embedding.length,
        isValidArray,
        hasCorrectLength,
        allNumbers,
        hasValidRange,
        firstTen: result.embedding.slice(0, 10),
        lastTen: result.embedding.slice(-10),
        sampleValues: {
          min: Math.min(...result.embedding),
          max: Math.max(...result.embedding),
          avg: result.embedding.reduce((sum, val) => sum + val, 0) / result.embedding.length
        }
      },
      processingTime: endTime - startTime,
      validation: {
        isValidArray,
        hasCorrectLength,
        allNumbers,
        hasValidRange,
        overall: isValidArray && hasCorrectLength && allNumbers && hasValidRange
      }
    });

  } catch (error) {
    console.error('[test-embedding] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint with { \"text\": \"your text here\" } to test embedding generation",
    example: {
      method: "POST",
      body: { text: "This is a test text for embedding generation." }
    }
  });
}