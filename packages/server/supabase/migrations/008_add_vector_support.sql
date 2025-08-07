-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create transcript_chunks table for RAG system
CREATE TABLE IF NOT EXISTS transcript_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  start_time FLOAT, -- Start time in seconds
  end_time FLOAT,   -- End time in seconds
  embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique chunks per video
  UNIQUE(video_id, chunk_index)
);

-- Add vector columns to existing video_summaries table
ALTER TABLE video_summaries 
ADD COLUMN IF NOT EXISTS summary_embedding vector(1536),
ADD COLUMN IF NOT EXISTS description_embedding vector(1536);

-- Create indexes for vector similarity search
CREATE INDEX IF NOT EXISTS transcript_chunks_embedding_idx 
ON transcript_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS transcript_chunks_video_id_idx 
ON transcript_chunks(video_id);

CREATE INDEX IF NOT EXISTS video_summaries_summary_embedding_idx 
ON video_summaries USING hnsw (summary_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS video_summaries_description_embedding_idx 
ON video_summaries USING hnsw (description_embedding vector_cosine_ops);

-- Function to search similar transcript chunks
CREATE OR REPLACE FUNCTION match_transcript_chunks(
  query_embedding vector(1536),
  video_id_filter TEXT DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.78,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  video_id TEXT,
  content TEXT,
  start_time FLOAT,
  end_time FLOAT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    tc.id,
    tc.video_id,
    tc.content,
    tc.start_time,
    tc.end_time,
    1 - (tc.embedding <=> query_embedding) AS similarity
  FROM transcript_chunks tc
  WHERE 
    (video_id_filter IS NULL OR tc.video_id = video_id_filter)
    AND 1 - (tc.embedding <=> query_embedding) > match_threshold
  ORDER BY tc.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- Function to search similar video summaries
CREATE OR REPLACE FUNCTION match_video_summaries(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.78,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  video_id TEXT,
  video_title TEXT,
  summary TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    vs.id,
    vs.video_id,
    vs.video_title,
    vs.summary,
    1 - (vs.summary_embedding <=> query_embedding) AS similarity
  FROM video_summaries vs
  WHERE 
    vs.summary_embedding IS NOT NULL
    AND 1 - (vs.summary_embedding <=> query_embedding) > match_threshold
  ORDER BY vs.summary_embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- RLS policies for transcript_chunks
ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;

-- Users can only access chunks for videos they have access to
CREATE POLICY "Users can view transcript chunks for their videos" ON transcript_chunks
  FOR SELECT USING (
    video_id IN (
      SELECT video_id FROM video_summaries WHERE user_id = auth.uid()
    )
  );

-- Service role can manage all transcript chunks
CREATE POLICY "Service role can manage transcript chunks" ON transcript_chunks
  FOR ALL USING (auth.role() = 'service_role');