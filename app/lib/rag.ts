/**
 * RAG (Retrieval-Augmented Generation) system
 * Handles vector search and context retrieval for enhanced chat responses
 */

import { supabaseAdmin } from './supabase';
import { generateEmbedding } from './embeddings';
import { parseAndChunkDialog, optimizeChunks, TranscriptChunk } from './text-chunking';
import { searchWeb, formatWebSearchContext, extractSearchTerms, shouldUseWebSearch, type WebSearchResponse } from './web-search';

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

  console.log(`[RAG Search] Starting search for query: "${query.substring(0, 100)}..."`);
  console.log(`[RAG Search] Parameters:`, { videoId, limit, threshold, includeTimestamps });

  try {
    // Check if chunks exist for this video first
    if (videoId) {
      const { data: chunkCount, error: countError } = await supabaseAdmin
        .from('transcript_chunks')
        .select('id', { count: 'exact' })
        .eq('video_id', videoId);
      
      console.log(`[RAG Search] Available chunks for video ${videoId}: ${chunkCount?.length || 0}`);
      
      if (!chunkCount || chunkCount.length === 0) {
        console.warn(`[RAG Search] No chunks found for video ${videoId}`);
        return {
          chunks: [],
          totalChunks: 0,
          maxSimilarity: 0,
          avgSimilarity: 0
        };
      }
    }

    // Generate embedding for the query
    console.log(`[RAG Search] Generating embedding for query...`);
    const startTime = Date.now();
    const { embedding: queryEmbedding } = await generateEmbedding(query);
    const embeddingTime = Date.now() - startTime;
    console.log(`[RAG Search] Query embedding generated in ${embeddingTime}ms`);

    // Search for similar chunks using Supabase RPC function
    console.log(`[RAG Search] Searching for similar chunks using match_transcript_chunks...`);
    const searchStartTime = Date.now();
    const { data: chunks, error } = await supabaseAdmin
      .rpc('match_transcript_chunks', {
        query_embedding: queryEmbedding,
        video_id_filter: videoId,
        match_threshold: threshold,
        match_count: limit
      });
    const searchTime = Date.now() - searchStartTime;
    console.log(`[RAG Search] Vector search completed in ${searchTime}ms`);

    if (error) {
      console.error('[RAG Search] Error searching transcript chunks:', error);
      return {
        chunks: [],
        totalChunks: 0,
        maxSimilarity: 0,
        avgSimilarity: 0
      };
    }

    console.log(`[RAG Search] Found ${chunks?.length || 0} chunks from vector search`);
    if (chunks && chunks.length > 0) {
      chunks.forEach((chunk, index) => {
        console.log(`[RAG Search] Chunk ${index + 1}: similarity=${chunk.similarity?.toFixed(3)}, content="${chunk.content?.substring(0, 100)}..."`);
      });
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

    console.log(`[RAG Search] Search results:`, {
      totalChunks: relevantChunks.length,
      maxSimilarity: maxSimilarity.toFixed(3),
      avgSimilarity: avgSimilarity.toFixed(3),
      aboveThreshold: relevantChunks.filter(c => c.similarity >= threshold).length
    });

    return {
      chunks: relevantChunks,
      totalChunks: relevantChunks.length,
      maxSimilarity,
      avgSimilarity
    };
  } catch (error) {
    console.error('[RAG Search] Error in searchRelevantChunks:', error);
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
    console.log(`[processAndStoreVideoChunks] Starting processing for video: ${videoId}`);
    console.log(`[processAndStoreVideoChunks] Dialog length: ${dialog.length}, overwrite: ${overwriteExisting}`);
    
    // Check if chunks already exist
    if (!overwriteExisting) {
      const { data: existingChunks } = await supabaseAdmin
        .from('transcript_chunks')
        .select('id')
        .eq('video_id', videoId)
        .limit(1);

      if (existingChunks && existingChunks.length > 0) {
        console.log(`[processAndStoreVideoChunks] Chunks already exist for video: ${videoId}`);
        return {
          success: true,
          chunksStored: 0,
          error: 'Chunks already exist for this video'
        };
      }
    } else {
      // Delete existing chunks if overwriting
      console.log(`[processAndStoreVideoChunks] Deleting existing chunks for video: ${videoId}`);
      const { error: deleteError } = await supabaseAdmin
        .from('transcript_chunks')
        .delete()
        .eq('video_id', videoId);
      
      if (deleteError) {
        console.error(`[processAndStoreVideoChunks] Error deleting existing chunks:`, deleteError);
      }
    }

    // Parse and chunk the dialog
    console.log(`[processAndStoreVideoChunks] Starting dialog parsing and chunking...`);
    const chunks = parseAndChunkDialog(dialog, maxTokensPerChunk);
    console.log(`[processAndStoreVideoChunks] Generated ${chunks.length} initial chunks`);
    
    const optimizedChunks = optimizeChunks(chunks, 100);
    console.log(`[processAndStoreVideoChunks] Optimized to ${optimizedChunks.length} chunks`);

    if (optimizedChunks.length === 0) {
      console.error(`[processAndStoreVideoChunks] No valid chunks generated from dialog`);
      console.log(`[processAndStoreVideoChunks] Dialog preview:`, dialog.substring(0, 500));
      return {
        success: false,
        chunksStored: 0,
        error: 'No valid chunks generated from dialog'
      };
    }

    // Generate embeddings for all chunks
    const texts = optimizedChunks.map(chunk => chunk.content);
    console.log(`[processAndStoreVideoChunks] Starting embedding generation for ${texts.length} chunks`);
    
    // Log first few chunks for debugging
    texts.slice(0, 3).forEach((text, index) => {
      console.log(`[processAndStoreVideoChunks] Chunk ${index} preview:`, text.substring(0, 200));
    });
    
    const embeddings = [];

    // Process embeddings in smaller batches to avoid API limits
    const batchSize = 10; // Reduced batch size for more stability
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`[processAndStoreVideoChunks] Processing embedding batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}`);
      
      const batchEmbeddings = await Promise.all(
        batch.map(async (text, batchIndex) => {
          try {
            if (!text || text.trim().length === 0) {
              console.warn(`[processAndStoreVideoChunks] Empty text in chunk ${i + batchIndex}`);
              return null;
            }
            
            console.log(`[processAndStoreVideoChunks] Generating embedding for chunk ${i + batchIndex}, length: ${text.length}`);
            const { embedding } = await generateEmbedding(text);
            console.log(`[processAndStoreVideoChunks] Successfully generated embedding for chunk ${i + batchIndex}`);
            return embedding;
          } catch (error) {
            console.error(`[processAndStoreVideoChunks] Failed to generate embedding for chunk ${i + batchIndex}:`, error);
            return null;
          }
        })
      );
      embeddings.push(...batchEmbeddings);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < texts.length) {
        console.log(`[processAndStoreVideoChunks] Waiting 500ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`[processAndStoreVideoChunks] Embedding generation complete. Success rate: ${embeddings.filter(e => e !== null).length}/${embeddings.length}`)

    // Prepare chunk data for database insertion
    console.log(`[processAndStoreVideoChunks] Preparing data for database insertion...`);
    const chunkData = optimizedChunks
      .map((chunk, index) => {
        const embedding = embeddings[index];
        if (!embedding) {
          console.warn(`[processAndStoreVideoChunks] No embedding for chunk ${index}, skipping`);
          return null;
        }

        if (!chunk.content || chunk.content.trim().length === 0) {
          console.warn(`[processAndStoreVideoChunks] Empty content for chunk ${index}, skipping`);
          return null;
        }

        // Validate embedding before storing
        if (!Array.isArray(embedding) || embedding.length !== 1536) {
          console.error(`[processAndStoreVideoChunks] Invalid embedding for chunk ${index}: dimensions = ${embedding?.length}`);
          return null;
        }

        console.log(`[processAndStoreVideoChunks] Valid embedding for chunk ${index}: dimensions = ${embedding.length}`);

        return {
          video_id: videoId,
          chunk_index: chunk.index,
          content: chunk.content,
          start_time: chunk.startTime || null,
          end_time: chunk.endTime || null,
          embedding: embedding, // Keep as array, let Supabase handle conversion
          token_count: chunk.tokenCount
        };
      })
      .filter(Boolean);

    console.log(`[processAndStoreVideoChunks] Prepared ${chunkData.length} chunks for insertion`);

    if (chunkData.length === 0) {
      console.error(`[processAndStoreVideoChunks] No valid chunks to insert after filtering`);
      return {
        success: false,
        chunksStored: 0,
        error: 'Failed to generate embeddings for chunks'
      };
    }

    // Insert chunks into database one by one to debug embedding issues
    console.log(`[processAndStoreVideoChunks] Inserting ${chunkData.length} chunks into database one by one...`);
    let successfulInserts = 0;
    
    for (let i = 0; i < chunkData.length; i++) {
      const chunk = chunkData[i];
      console.log(`[processAndStoreVideoChunks] Inserting chunk ${i}:`, {
        content_length: chunk.content.length,
        embedding_length: chunk.embedding.length,
        embedding_type: typeof chunk.embedding,
        embedding_sample: chunk.embedding.slice(0, 5)
      });
      
      try {
        const { error: insertError, data: insertedData } = await supabaseAdmin
          .from('transcript_chunks')
          .insert([chunk])
          .select('id, embedding');

        if (insertError) {
          console.error(`[processAndStoreVideoChunks] Error inserting chunk ${i}:`, insertError);
          continue;
        }

        // Check the inserted embedding dimensions
        if (insertedData && insertedData[0]) {
          const storedEmbedding = insertedData[0].embedding;
          console.log(`[processAndStoreVideoChunks] ✅ Chunk ${i} inserted. Stored embedding dimensions:`, Array.isArray(storedEmbedding) ? storedEmbedding.length : 'not array');
        }
        
        successfulInserts++;
      } catch (error) {
        console.error(`[processAndStoreVideoChunks] Exception inserting chunk ${i}:`, error);
      }
    }

    console.log(`[processAndStoreVideoChunks] Successfully inserted ${successfulInserts}/${chunkData.length} chunks`)

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
    enableWebSearch?: boolean;
  } = {}
): Promise<{ context: string; source: 'rag' | 'summary' | 'web+summary' | 'web' | 'none'; metadata?: any }> {
  const {
    maxChunks = 3,
    maxContextLength = 2000,
    fallbackToSummary = true,
    enableWebSearch = true
  } = options;

  console.log(`[Enhanced Context] Starting context retrieval for video: ${videoId}`);
  console.log(`[Enhanced Context] Query: "${query.substring(0, 100)}..."`);
  console.log(`[Enhanced Context] Options:`, { maxChunks, maxContextLength, fallbackToSummary });

  try {
    // First, try to get relevant chunks using RAG
    console.log(`[Enhanced Context] Attempting RAG search...`);
    const ragStartTime = Date.now();
    const ragContext = await searchRelevantChunks(query, videoId, {
      limit: maxChunks,
      threshold: 0.5  // Lowered threshold for better recall
    });
    const ragTime = Date.now() - ragStartTime;
    console.log(`[Enhanced Context] RAG search completed in ${ragTime}ms`);

    if (ragContext.chunks.length > 0) {
      console.log(`[Enhanced Context] ✅ Using RAG context with ${ragContext.chunks.length} chunks`);
      
      // Combine relevant chunks into context
      let context = ragContext.chunks
        .map((chunk, index) => {
          let text = chunk.content;
          if (chunk.startTime && chunk.endTime) {
            text += ` [${Math.floor(chunk.startTime)}s-${Math.floor(chunk.endTime)}s]`;
          }
          console.log(`[Enhanced Context] RAG Chunk ${index + 1}: similarity=${chunk.similarity.toFixed(3)}, length=${chunk.content.length}`);
          return text;
        })
        .join('\n\n');

      // Truncate if too long
      const originalLength = context.length;
      if (context.length > maxContextLength) {
        context = context.substring(0, maxContextLength) + '...';
        console.log(`[Enhanced Context] Context truncated from ${originalLength} to ${context.length} characters`);
      }

      const result = {
        context,
        source: 'rag' as const,
        metadata: {
          chunksUsed: ragContext.chunks.length,
          maxSimilarity: ragContext.maxSimilarity,
          avgSimilarity: ragContext.avgSimilarity,
          contextLength: context.length,
          processingTime: ragTime
        }
      };

      console.log(`[Enhanced Context] RAG context metadata:`, result.metadata);
      return result;
    }

    // Fallback to enhanced context (web search + summary)
    console.log(`[Enhanced Context] ⚠️  No RAG chunks found, attempting enhanced fallback...`);
    
    let webSearchResults: WebSearchResponse | null = null;
    let summaryContent = '';
    
    // Get video data for context
    const { data: videoData } = await supabaseAdmin
      .from('video_summaries')
      .select('summary, video_title')
      .eq('video_id', videoId)
      .single();

    // Try web search if enabled and query seems suitable
    if (enableWebSearch && shouldUseWebSearch(query)) {
      console.log(`[Enhanced Context] 🌐 Query suitable for web search, attempting...`);
      try {
        const webSearchStartTime = Date.now();
        const searchTerms = extractSearchTerms(query, videoData?.video_title);
        console.log(`[Enhanced Context] Web search terms: "${searchTerms}"`);
        
        webSearchResults = await searchWeb(searchTerms, {
          maxResults: 3,
          language: 'ko'
        });
        
        const webSearchTime = Date.now() - webSearchStartTime;
        console.log(`[Enhanced Context] Web search completed in ${webSearchTime}ms, found ${webSearchResults.results.length} results`);
      } catch (webSearchError) {
        console.error(`[Enhanced Context] Web search failed:`, webSearchError);
      }
    }

    // Get summary if available
    if (fallbackToSummary && videoData?.summary) {
      summaryContent = videoData.summary;
      console.log(`[Enhanced Context] Found summary (length: ${summaryContent.length})`);
    }

    // Combine web search and summary results
    if (webSearchResults && webSearchResults.results.length > 0 && summaryContent) {
      console.log(`[Enhanced Context] ✅ Using combined web search + summary context`);
      
      const webContext = formatWebSearchContext(webSearchResults);
      const combinedContext = `${webContext}\n\n비디오 요약:\n${summaryContent}`;
      
      // Truncate if too long
      let finalContext = combinedContext;
      if (combinedContext.length > maxContextLength) {
        finalContext = combinedContext.substring(0, maxContextLength) + '...';
        console.log(`[Enhanced Context] Combined context truncated from ${combinedContext.length} to ${finalContext.length} characters`);
      }
      
      return {
        context: finalContext,
        source: 'web+summary',
        metadata: {
          webSearchResults: webSearchResults.results.length,
          summaryLength: summaryContent.length,
          combinedLength: finalContext.length,
          searchTerms: extractSearchTerms(query, videoData?.video_title)
        }
      };
    } else if (webSearchResults && webSearchResults.results.length > 0) {
      console.log(`[Enhanced Context] ✅ Using web search only context`);
      
      const webContext = formatWebSearchContext(webSearchResults);
      return {
        context: webContext,
        source: 'web',
        metadata: {
          webSearchResults: webSearchResults.results.length,
          searchTerms: extractSearchTerms(query, videoData?.video_title)
        }
      };
    } else if (summaryContent) {
      console.log(`[Enhanced Context] ✅ Using summary only context`);
      
      return {
        context: summaryContent,
        source: 'summary',
        metadata: {
          summaryLength: summaryContent.length
        }
      };
    } else {
      console.warn(`[Enhanced Context] ❌ No summary found for video ${videoId}`);
    }

    console.warn(`[Enhanced Context] ❌ No context available (neither RAG nor summary)`);
    return {
      context: '',
      source: 'none'
    };

  } catch (error) {
    console.error('[Enhanced Context] ❌ Error getting enhanced context:', error);
    
    // Fallback to summary on error
    if (fallbackToSummary) {
      console.log(`[Enhanced Context] Attempting emergency fallback to summary...`);
      try {
        const { data: videoData } = await supabaseAdmin
          .from('video_summaries')
          .select('summary')
          .eq('video_id', videoId)
          .single();

        if (videoData?.summary) {
          console.log(`[Enhanced Context] ✅ Emergency fallback successful (summary length: ${videoData.summary.length})`);
          return {
            context: videoData.summary,
            source: 'summary',
            metadata: {
              summaryLength: videoData.summary.length,
              fallbackReason: 'RAG error'
            }
          };
        }
      } catch (fallbackError) {
        console.error('[Enhanced Context] ❌ Emergency fallback to summary also failed:', fallbackError);
      }
    }

    console.error(`[Enhanced Context] ❌ All context retrieval methods failed`);
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