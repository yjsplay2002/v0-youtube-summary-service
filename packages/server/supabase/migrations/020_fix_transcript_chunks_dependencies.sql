-- Fix transcript_chunks dependencies before removing video_id from video_summaries
-- This migration updates the RLS policy to use the new video_info structure

-- Drop the existing policy that depends on video_summaries.video_id
DROP POLICY IF EXISTS "Users can view transcript chunks for their videos" ON transcript_chunks;

-- Create new policy that uses the video_info structure
CREATE POLICY "Users can view transcript chunks for their videos" ON transcript_chunks
  FOR SELECT USING (
    video_id IN (
      SELECT vi.video_id 
      FROM video_summaries vs
      JOIN video_info vi ON vs.video_info_id = vi.id
      WHERE vs.user_id = auth.uid()
    )
  );

-- Also add video_info_id column to transcript_chunks for better performance (optional)
-- This would eliminate the need for the join in the policy
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

-- Create an improved policy using video_info_id for better performance
DROP POLICY IF EXISTS "Users can view transcript chunks for their videos" ON transcript_chunks;

CREATE POLICY "Users can view transcript chunks for their videos" ON transcript_chunks
  FOR SELECT USING (
    video_info_id IN (
      SELECT video_info_id 
      FROM video_summaries 
      WHERE user_id = auth.uid()
    )
  );