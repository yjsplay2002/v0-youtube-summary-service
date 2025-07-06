/**
 * OpenAI Embeddings service for RAG system
 * Generates vector embeddings for text chunks and queries
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Using text-embedding-3-small for cost efficiency and good performance
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text input cannot be empty');
    }

    console.log(`[generateEmbedding] Generating embedding for text length: ${text.length}`);
    
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.replace(/\n/g, ' '), // Normalize whitespace
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data[0].embedding;
    const tokenCount = response.usage?.total_tokens || 0;

    // Validate embedding dimensions
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
      console.error(`[generateEmbedding] Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding?.length}`);
      throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding?.length}`);
    }

    // Validate embedding values
    if (!embedding.every(val => typeof val === 'number' && !isNaN(val))) {
      console.error(`[generateEmbedding] Invalid embedding values detected`);
      throw new Error('Invalid embedding values detected');
    }

    console.log(`[generateEmbedding] ✅ Successfully generated embedding: ${embedding.length} dimensions, ${tokenCount} tokens`);

    return {
      embedding,
      tokenCount
    };
  } catch (error) {
    console.error('[generateEmbedding] Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * OpenAI allows up to 2048 inputs per request
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize: number = 100
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];
  
  // Process in batches to avoid API limits
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    
    try {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map(text => text.replace(/\n/g, ' ')),
        dimensions: EMBEDDING_DIMENSIONS,
      });

      const batchResults = response.data.map((item, index) => ({
        embedding: item.embedding,
        tokenCount: Math.ceil((response.usage?.total_tokens || 0) / batch.length)
      }));

      results.push(...batchResults);
    } catch (error) {
      console.error(`Error generating embeddings for batch ${i}-${i + batchSize}:`, error);
      // Add empty results for failed batch to maintain array alignment
      const emptyResults = batch.map(() => ({
        embedding: new Array(EMBEDDING_DIMENSIONS).fill(0),
        tokenCount: 0
      }));
      results.push(...emptyResults);
    }

    // Add small delay between batches to avoid rate limiting
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find most similar embeddings using cosine similarity
 */
export function findSimilarEmbeddings(
  queryEmbedding: number[],
  embeddings: Array<{ embedding: number[]; metadata?: any }>,
  threshold: number = 0.7,
  limit: number = 10
): Array<{ similarity: number; metadata?: any }> {
  const similarities = embeddings.map(({ embedding, metadata }) => ({
    similarity: cosineSimilarity(queryEmbedding, embedding),
    metadata
  }));

  return similarities
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Validate embedding dimensions
 */
export function validateEmbedding(embedding: number[]): boolean {
  return (
    Array.isArray(embedding) &&
    embedding.length === EMBEDDING_DIMENSIONS &&
    embedding.every(val => typeof val === 'number' && !isNaN(val))
  );
}

/**
 * Normalize embedding vector (convert to unit vector)
 */
export function normalizeEmbedding(embedding: number[]): number[] {
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / norm);
}

/**
 * Estimate embedding cost
 */
export function estimateEmbeddingCost(tokenCount: number): number {
  // text-embedding-3-small: $0.00002 per 1K tokens
  return (tokenCount / 1000) * 0.00002;
}

/**
 * Get embedding model info
 */
export function getEmbeddingModelInfo() {
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    costPer1kTokens: 0.00002,
    maxTokensPerRequest: 8191
  };
}