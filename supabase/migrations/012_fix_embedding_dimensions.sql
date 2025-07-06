-- Fix embedding dimension issues
-- Clear all existing transcript chunks with invalid embeddings
DELETE FROM transcript_chunks;

-- Add constraint to ensure embedding dimensions are correct
ALTER TABLE transcript_chunks 
DROP CONSTRAINT IF EXISTS check_embedding_dimensions;

ALTER TABLE transcript_chunks 
ADD CONSTRAINT check_embedding_dimensions 
CHECK (array_length(embedding, 1) = 1536);

-- Create a function to validate embedding dimensions
CREATE OR REPLACE FUNCTION validate_embedding_dimensions()
RETURNS trigger AS $$
BEGIN
  IF NEW.embedding IS NOT NULL AND array_length(NEW.embedding, 1) != 1536 THEN
    RAISE EXCEPTION 'Embedding must have exactly 1536 dimensions, got %', array_length(NEW.embedding, 1);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to validate embeddings before insert/update
DROP TRIGGER IF EXISTS validate_embedding_trigger ON transcript_chunks;
CREATE TRIGGER validate_embedding_trigger
  BEFORE INSERT OR UPDATE ON transcript_chunks
  FOR EACH ROW
  EXECUTE FUNCTION validate_embedding_dimensions();

-- Update the match_transcript_chunks function to add debugging
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
    tc.embedding IS NOT NULL
    AND array_length(tc.embedding, 1) = 1536
    AND (video_id_filter IS NULL OR tc.video_id = video_id_filter)
    AND 1 - (tc.embedding <=> query_embedding) > match_threshold
  ORDER BY tc.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;