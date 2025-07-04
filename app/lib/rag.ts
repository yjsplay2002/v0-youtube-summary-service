/**
 * RAG (Retrieval-Augmented Generation) system
 * Handles vector search and context retrieval for enhanced chat responses
 */

import { supabaseAdmin } from './supabase';
import { generateEmbedding } from './embeddings';
import { parseAndChunkDialog, optimizeChunks, TranscriptChunk } from './text-chunking';

export interface RelevantChunk {
  id: string;
  videoId: string;
  content: string;
  startTime?: number;
  endTime?: number;
  similarity: number;
}

export interface RAGContext {
  chunks: RelevantChunk[];
  totalChunks: number;
  maxSimilarity: number;
  avgSimilarity: number;
}

/**
 * Search for relevant transcript chunks using vector similarity
 */
export async function searchRelevantChunks(
  query: string,
  videoId?: string,
  options: {
    limit?: number;
    threshold?: number;
    includeTimestamps?: boolean;
  } = {}
): Promise<RAGContext> {
  const {
    limit = 5,
    threshold = 0.75,
    includeTimestamps = true
  } = options;

  try {
    // Generate embedding for the query
    const { embedding: queryEmbedding } = await generateEmbedding(query);

    // Search for similar chunks using Supabase RPC function
    const { data: chunks, error } = await supabaseAdmin
      .rpc('match_transcript_chunks', {
        query_embedding: queryEmbedding,
        video_id_filter: videoId,
        match_threshold: threshold,
        match_count: limit
      });

    if (error) {
      console.error('Error searching transcript chunks:', error);
      return {
        chunks: [],
        totalChunks: 0,
        maxSimilarity: 0,
        avgSimilarity: 0
      };
    }

    const relevantChunks: RelevantChunk[] = (chunks || []).map(chunk => ({
      id: chunk.id,
      videoId: chunk.video_id,
      content: chunk.content,
      startTime: includeTimestamps ? chunk.start_time : undefined,
      endTime: includeTimestamps ? chunk.end_time : undefined,
      similarity: chunk.similarity
    }));

    const similarities = relevantChunks.map(c => c.similarity);
    const maxSimilarity = similarities.length > 0 ? Math.max(...similarities) : 0;
    const avgSimilarity = similarities.length > 0 
      ? similarities.reduce((sum, s) => sum + s, 0) / similarities.length 
      : 0;

    return {
      chunks: relevantChunks,
      totalChunks: relevantChunks.length,
      maxSimilarity,
      avgSimilarity
    };
  } catch (error) {
    console.error('Error in searchRelevantChunks:', error);
    return {
      chunks: [],
      totalChunks: 0,
      maxSimilarity: 0,
      avgSimilarity: 0
    };
  }
}

/**
 * Process video dialog and store chunks with embeddings
 */
export async function processAndStoreVideoChunks(
  videoId: string,
  dialog: string,
  options: {
    maxTokensPerChunk?: number;
    overwriteExisting?: boolean;
  } = {}
): Promise<{ success: boolean; chunksStored: number; error?: string }> {
  const {
    maxTokensPerChunk = 500,
    overwriteExisting = false
  } = options;

  try {
    // Check if chunks already exist
    if (!overwriteExisting) {
      const { data: existingChunks } = await supabaseAdmin
        .from('transcript_chunks')
        .select('id')
        .eq('video_id', videoId)
        .limit(1);

      if (existingChunks && existingChunks.length > 0) {
        return {
          success: true,
          chunksStored: 0,
          error: 'Chunks already exist for this video'
        };
      }
    } else {
      // Delete existing chunks if overwriting
      await supabaseAdmin
        .from('transcript_chunks')
        .delete()
        .eq('video_id', videoId);
    }

    // Parse and chunk the dialog
    const chunks = parseAndChunkDialog(dialog, maxTokensPerChunk);
    const optimizedChunks = optimizeChunks(chunks, 100);

    if (optimizedChunks.length === 0) {
      return {
        success: false,
        chunksStored: 0,
        error: 'No valid chunks generated from dialog'
      };
    }

    // Generate embeddings for all chunks
    const texts = optimizedChunks.map(chunk => chunk.content);
    const embeddings = [];

    // Process embeddings in smaller batches to avoid API limits
    const batchSize = 20;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(async (text) => {
          try {
            const { embedding } = await generateEmbedding(text);
            return embedding;
          } catch (error) {
            console.error('Failed to generate embedding for chunk:', error);
            return null;
          }
        })
      );
      embeddings.push(...batchEmbeddings);

      // Small delay between batches
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Prepare chunk data for database insertion
    const chunkData = optimizedChunks
      .map((chunk, index) => {
        const embedding = embeddings[index];
        if (!embedding) return null;

        return {
          video_id: videoId,
          chunk_index: chunk.index,
          content: chunk.content,
          start_time: chunk.startTime,
          end_time: chunk.endTime,
          embedding,
          token_count: chunk.tokenCount
        };
      })
      .filter(Boolean);

    if (chunkData.length === 0) {
      return {
        success: false,
        chunksStored: 0,
        error: 'Failed to generate embeddings for chunks'
      };
    }

    // Insert chunks into database
    const { error: insertError } = await supabaseAdmin
      .from('transcript_chunks')
      .insert(chunkData);

    if (insertError) {
      console.error('Error inserting chunks:', insertError);
      return {
        success: false,
        chunksStored: 0,
        error: `Database insertion failed: ${insertError.message}`
      };
    }

    return {
      success: true,
      chunksStored: chunkData.length
    };

  } catch (error) {
    console.error('Error processing video chunks:', error);
    return {
      success: false,
      chunksStored: 0,
      error: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Get enhanced context for chat using RAG
 */
export async function getEnhancedContext(
  query: string,
  videoId: string,
  options: {
    maxChunks?: number;
    maxContextLength?: number;
    fallbackToSummary?: boolean;
  } = {}
): Promise<{ context: string; source: 'rag' | 'summary' | 'none'; metadata?: any }> {
  const {
    maxChunks = 3,
    maxContextLength = 2000,
    fallbackToSummary = true
  } = options;

  try {
    // First, try to get relevant chunks using RAG
    const ragContext = await searchRelevantChunks(query, videoId, {
      limit: maxChunks,
      threshold: 0.7
    });

    if (ragContext.chunks.length > 0) {
      // Combine relevant chunks into context
      let context = ragContext.chunks
        .map(chunk => {
          let text = chunk.content;
          if (chunk.startTime && chunk.endTime) {
            text += ` [${Math.floor(chunk.startTime)}s-${Math.floor(chunk.endTime)}s]`;
          }
          return text;
        })
        .join('\n\n');

      // Truncate if too long
      if (context.length > maxContextLength) {
        context = context.substring(0, maxContextLength) + '...';
      }

      return {
        context,
        source: 'rag',
        metadata: {
          chunksUsed: ragContext.chunks.length,
          maxSimilarity: ragContext.maxSimilarity,
          avgSimilarity: ragContext.avgSimilarity
        }
      };
    }

    // Fallback to summary if RAG doesn't find relevant chunks
    if (fallbackToSummary) {
      const { data: videoData } = await supabaseAdmin
        .from('video_summaries')
        .select('summary')
        .eq('video_id', videoId)
        .single();

      if (videoData?.summary) {
        return {
          context: videoData.summary,
          source: 'summary'
        };
      }
    }

    return {
      context: '',
      source: 'none'
    };

  } catch (error) {
    console.error('Error getting enhanced context:', error);
    
    // Fallback to summary on error
    if (fallbackToSummary) {
      try {
        const { data: videoData } = await supabaseAdmin
          .from('video_summaries')
          .select('summary')
          .eq('video_id', videoId)
          .single();

        if (videoData?.summary) {
          return {
            context: videoData.summary,
            source: 'summary'
          };
        }
      } catch (fallbackError) {
        console.error('Fallback to summary also failed:', fallbackError);
      }
    }

    return {
      context: '',
      source: 'none'
    };
  }
}

/**
 * Get statistics about stored chunks for a video
 */
export async function getVideoChunkStats(videoId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('transcript_chunks')
      .select('id, token_count, start_time, end_time')
      .eq('video_id', videoId);

    if (error) {
      console.error('Error getting chunk stats:', error);
      return null;
    }

    const totalChunks = data?.length || 0;
    const totalTokens = data?.reduce((sum, chunk) => sum + (chunk.token_count || 0), 0) || 0;
    const timeRange = data && data.length > 0 ? {
      start: Math.min(...data.map(c => c.start_time).filter(t => t !== null)),
      end: Math.max(...data.map(c => c.end_time).filter(t => t !== null))
    } : null;

    return {
      totalChunks,
      totalTokens,
      avgTokensPerChunk: totalChunks > 0 ? Math.round(totalTokens / totalChunks) : 0,
      timeRange
    };
  } catch (error) {
    console.error('Error getting video chunk stats:', error);
    return null;
  }
}