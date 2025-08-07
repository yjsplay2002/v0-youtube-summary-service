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
 * Extract text content from Apify data structure
 */
function extractTextFromApifyData(data: any): string {
  console.log('[extractTextFromApifyData] Input data type:', typeof data);
  console.log('[extractTextFromApifyData] Input data preview:', JSON.stringify(data).substring(0, 500));
  
  // If it's already a string, return it
  if (typeof data === 'string') {
    console.log('[extractTextFromApifyData] Input is string, length:', data.length);
    return data;
  }
  
  // If it's an object, try to extract transcript/text content
  if (typeof data === 'object' && data !== null) {
    // Try common transcript field names
    const possibleFields = [
      'transcript', 'text', 'content', 'subtitles', 
      'captions', 'dialog', 'script', 'transcription'
    ];
    
    for (const field of possibleFields) {
      if (data[field]) {
        console.log(`[extractTextFromApifyData] Found content in field: ${field}`);
        
        if (typeof data[field] === 'string') {
          return data[field];
        } else if (Array.isArray(data[field])) {
          // Extract text from array of transcript items
          const textArray = data[field]
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object') {
                return item.text || item.content || item.transcript || '';
              }
              return '';
            })
            .filter((text: string) => text.trim().length > 0);
          
          if (textArray.length > 0) {
            console.log(`[extractTextFromApifyData] Extracted ${textArray.length} text items from array`);
            return textArray.join(' ');
          }
        }
      }
    }
    
    // Try to extract from nested objects
    const values = Object.values(data);
    for (const value of values) {
      if (typeof value === 'string' && value.length > 100) {
        console.log('[extractTextFromApifyData] Found long string in object values');
        return value;
      }
      if (Array.isArray(value) && value.length > 0) {
        const extracted = extractTextFromApifyData(value);
        if (extracted && extracted.length > 100) {
          console.log('[extractTextFromApifyData] Found content in nested array');
          return extracted;
        }
      }
    }
    
    // Last resort: convert entire object to string
    console.log('[extractTextFromApifyData] Using entire object as fallback');
    return JSON.stringify(data);
  }
  
  console.log('[extractTextFromApifyData] No text content found, returning empty string');
  return '';
}

/**
 * Parse dialog from JSON string and chunk it
 */
export function parseAndChunkDialog(
  dialogJson: string,
  maxTokensPerChunk: number = 500
): TranscriptChunk[] {
  console.log('[parseAndChunkDialog] Input length:', dialogJson.length);
  console.log('[parseAndChunkDialog] Input preview:', dialogJson.substring(0, 300));
  
  try {
    const dialog = JSON.parse(dialogJson);
    console.log('[parseAndChunkDialog] Parsed JSON type:', typeof dialog);
    console.log('[parseAndChunkDialog] Is array:', Array.isArray(dialog));
    
    // Extract text content from the data structure
    const textContent = extractTextFromApifyData(dialog);
    console.log('[parseAndChunkDialog] Extracted text length:', textContent.length);
    
    if (textContent.length === 0) {
      console.warn('[parseAndChunkDialog] No text content extracted, returning empty array');
      return [];
    }
    
    // Check if we have structured dialog data with timestamps
    if (Array.isArray(dialog) && dialog.length > 0 && 
        dialog[0] && typeof dialog[0] === 'object' && 
        (dialog[0].text || dialog[0].content)) {
      console.log('[parseAndChunkDialog] Using structured dialog chunking');
      return chunkDialogWithTime(dialog, maxTokensPerChunk);
    } else {
      console.log('[parseAndChunkDialog] Using simple text chunking');
      return chunkTranscriptByTokens(textContent, maxTokensPerChunk);
    }
  } catch (error) {
    console.error('[parseAndChunkDialog] Failed to parse dialog JSON:', error);
    console.log('[parseAndChunkDialog] Falling back to treating as plain text');
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