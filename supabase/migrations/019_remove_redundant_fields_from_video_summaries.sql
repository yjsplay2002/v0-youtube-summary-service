-- Remove redundant fields from video_summaries table after migration to video_info
-- This completes the data normalization process

-- Step 1: Verify that all video_summaries have video_info_id
-- (This should fail if migration wasn't successful)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM video_summaries 
    WHERE video_info_id IS NULL AND video_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Migration incomplete: Found video_summaries without video_info_id';
  END IF;
END $$;

-- Step 2: Make video_info_id NOT NULL
ALTER TABLE video_summaries ALTER COLUMN video_info_id SET NOT NULL;

-- Step 3: Fix dependencies before removing columns

-- Fix transcript_chunks RLS policy that depends on video_summaries.video_id
DROP POLICY IF EXISTS "Users can view transcript chunks for their videos" ON transcript_chunks;

-- Add video_info_id to transcript_chunks for better performance
ALTER TABLE transcript_chunks ADD COLUMN IF NOT EXISTS video_info_id UUID;

-- Update existing transcript_chunks records to include video_info_id
UPDATE transcript_chunks 
SET video_info_id = vi.id
FROM video_info vi
WHERE transcript_chunks.video_id = vi.video_id;

-- Add foreign key constraint for data integrity
ALTER TABLE transcript_chunks 
ADD CONSTRAINT fk_transcript_chunks_video_info 
FOREIGN KEY (video_info_id) REFERENCES video_info(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_video_info_id ON transcript_chunks(video_info_id);

-- Create new policy using video_info_id for better performance
CREATE POLICY "Users can view transcript chunks for their videos" ON transcript_chunks
  FOR SELECT USING (
    video_info_id IN (
      SELECT video_info_id 
      FROM video_summaries 
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: Remove redundant columns from video_summaries
-- These are now stored in video_info table
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_id;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_title;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_thumbnail;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_duration;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS channel_title;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_tags;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_description;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS dialog;

-- Step 5: Update existing views/queries will need to join with video_info
-- Add helpful comment for developers
COMMENT ON TABLE video_summaries IS 'Stores summary data. Join with video_info for video metadata.';
COMMENT ON COLUMN video_summaries.video_info_id IS 'Foreign key to video_info table containing video metadata';

-- Step 6: Create a view for backward compatibility (optional)
-- This view recreates the old structure for existing queries
CREATE OR REPLACE VIEW video_summaries_with_info AS
SELECT 
  vs.id,
  vs.user_id,
  vi.video_id,
  vi.video_title,
  vi.video_thumbnail,
  vi.video_duration,
  vi.channel_title,
  vi.video_tags,
  vi.video_description,
  vs.inferred_topics,
  vs.inferred_keywords,
  vs.summary,
  vs.summary_prompt,
  vi.dialog,
  vs.language,
  vs.video_info_id,
  vs.created_at,
  vs.updated_at
FROM video_summaries vs
JOIN video_info vi ON vs.video_info_id = vi.id;

-- Grant appropriate permissions to the view
GRANT SELECT ON video_summaries_with_info TO authenticated;
GRANT SELECT ON video_summaries_with_info TO service_role;