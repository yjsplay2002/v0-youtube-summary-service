/**
 * Text chunking utilities for RAG system
 * Splits transcript into meaningful chunks for vector embedding
 */

export interface TranscriptChunk {
  content: string;
  startTime?: number;
  endTime?: number;
  index: number;
  tokenCount: number;
}

export interface DialogItem {
  text: string;
  start?: number;
  end?: number;
  duration?: number;
}

/**
 * Simple token counting approximation
 * 1 token ≈ 4 characters for English, 2-3 characters for Korean
 */
function estimateTokenCount(text: string): number {
  // More conservative estimate for mixed Korean/English content
  return Math.ceil(text.length / 3);
}

/**
 * Split text into sentences, preserving sentence boundaries
 */
function splitIntoSentences(text: string): string[] {
  // Enhanced sentence splitting for Korean and English
  const sentences = text
    .split(/[.!?]\s+|[.!?]$|[。！？]\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences;
}

/**
 * Chunk transcript by token count with sentence boundary preservation
 */
export function chunkTranscriptByTokens(
  transcript: string,
  maxTokensPerChunk: number = 500,
  overlapTokens: number = 50
): TranscriptChunk[] {
  const sentences = splitIntoSentences(transcript);
  const chunks: TranscriptChunk[] = [];
  
  let currentChunk = '';
  let currentTokens = 0;
  let chunkIndex = 0;
  
  for (const sentence of sentences) {
    const sentenceTokens = estimateTokenCount(sentence);
    
    // If adding this sentence would exceed limit, finalize current chunk
    if (currentTokens + sentenceTokens > maxTokensPerChunk && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        tokenCount: currentTokens
      });
      
      // Start new chunk with overlap from previous chunk
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlapTokens / 4)); // Rough overlap
      currentChunk = overlapWords.join(' ') + ' ' + sentence;
      currentTokens = estimateTokenCount(currentChunk);
    } else {
      // Add sentence to current chunk
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens += sentenceTokens;
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      tokenCount: currentTokens
    });
  }
  
  return chunks;
}

/**
 * Chunk dialog data (from Apify) with time information
 */
export function chunkDialogWithTime(
  dialog: DialogItem[],
  maxTokensPerChunk: number = 500,
  overlapTokens: number = 50
): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];
  
  let currentChunk = '';
  let currentTokens = 0;
  let chunkIndex = 0;
  let startTime: number | undefined;
  let endTime: number | undefined;
  
  for (const item of dialog) {
    const itemTokens = estimateTokenCount(item.text);
    
    // If adding this item would exceed limit, finalize current chunk
    if (currentTokens + itemTokens > maxTokensPerChunk && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        tokenCount: currentTokens,
        startTime,
        endTime
      });
      
      // Start new chunk with overlap and new timing
      const sentences = splitIntoSentences(currentChunk);
      const overlapSentences = sentences.slice(-2); // Keep last 2 sentences for context
      currentChunk = overlapSentences.join(' ') + ' ' + item.text;
      currentTokens = estimateTokenCount(currentChunk);
      startTime = item.start;
      endTime = item.end;
    } else {
      // Add item to current chunk
      currentChunk += (currentChunk ? ' ' : '') + item.text;
      currentTokens += itemTokens;
      
      // Set timing for first item in chunk
      if (!startTime && item.start !== undefined) {
        startTime = item.start;
      }
      
      // Update end time with latest item
      if (item.end !== undefined) {
        endTime = item.end;
      }
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      tokenCount: currentTokens,
      startTime,
      endTime
    });
  }
  
  return chunks;
}

/**
 * Parse dialog from JSON string and chunk it
 */
export function parseAndChunkDialog(
  dialogJson: string,
  maxTokensPerChunk: number = 500
): TranscriptChunk[] {
  try {
    const dialog = JSON.parse(dialogJson);
    
    if (Array.isArray(dialog)) {
      return chunkDialogWithTime(dialog, maxTokensPerChunk);
    } else {
      // Fallback to simple text chunking if not in expected format
      const text = typeof dialog === 'string' ? dialog : JSON.stringify(dialog);
      return chunkTranscriptByTokens(text, maxTokensPerChunk);
    }
  } catch (error) {
    console.error('Failed to parse dialog JSON:', error);
    // Fallback to treating as plain text
    return chunkTranscriptByTokens(dialogJson, maxTokensPerChunk);
  }
}

/**
 * Optimize chunks by merging small adjacent chunks
 */
export function optimizeChunks(
  chunks: TranscriptChunk[],
  minTokensPerChunk: number = 100
): TranscriptChunk[] {
  const optimized: TranscriptChunk[] = [];
  
  for (const chunk of chunks) {
    if (chunk.tokenCount < minTokensPerChunk && optimized.length > 0) {
      // Merge with previous chunk
      const prevChunk = optimized[optimized.length - 1];
      prevChunk.content += ' ' + chunk.content;
      prevChunk.tokenCount += chunk.tokenCount;
      prevChunk.endTime = chunk.endTime || prevChunk.endTime;
    } else {
      optimized.push({ ...chunk });
    }
  }
  
  return optimized;
}