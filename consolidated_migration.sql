-- Consolidated Migration Script for Database Restructuring
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/hffgrebfohhhegkreakn/sql

-- =============================================================================
-- STEP 1: Create video_info table to store video metadata and dialog
-- =============================================================================

CREATE TABLE IF NOT EXISTS video_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id TEXT UNIQUE NOT NULL,
  video_title TEXT,
  video_thumbnail TEXT,
  video_duration TEXT,
  channel_title TEXT,
  video_tags TEXT[],
  video_description TEXT,
  dialog TEXT, -- Original transcript data from Apify
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookup by video_id
CREATE INDEX IF NOT EXISTS idx_video_info_video_id ON video_info(video_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE video_info ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read video info (public data)
CREATE POLICY "Allow public read access to video_info" ON video_info
  FOR SELECT USING (true);

-- Allow authenticated users to insert new video info
CREATE POLICY "Allow authenticated users to insert video_info" ON video_info
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow authenticated users to update video info
CREATE POLICY "Allow authenticated users to update video_info" ON video_info
  FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_video_info_updated_at
  BEFORE UPDATE ON video_info
  FOR EACH ROW
  EXECUTE FUNCTION update_video_info_updated_at();

-- =============================================================================
-- STEP 2: Migrate existing video_summaries data to new structure
-- =============================================================================

-- Add video_info_id column to video_summaries (nullable for now)
ALTER TABLE video_summaries ADD COLUMN IF NOT EXISTS video_info_id UUID;

-- Insert unique video data from video_summaries to video_info
INSERT INTO video_info (video_id, video_title, video_thumbnail, video_duration, channel_title, video_tags, video_description, dialog, created_at)
SELECT DISTINCT ON (video_id)
  video_id,
  video_title,
  video_thumbnail,
  video_duration,
  channel_title,
  video_tags,
  video_description,
  dialog,
  MIN(created_at) as created_at
FROM video_summaries 
WHERE video_id IS NOT NULL
GROUP BY video_id, video_title, video_thumbnail, video_duration, channel_title, video_tags, video_description, dialog
ON CONFLICT (video_id) DO NOTHING;

-- Update video_summaries to reference video_info
UPDATE video_summaries 
SET video_info_id = vi.id
FROM video_info vi
WHERE video_summaries.video_id = vi.video_id;

-- Add foreign key constraint
ALTER TABLE video_summaries 
ADD CONSTRAINT fk_video_summaries_video_info 
FOREIGN KEY (video_info_id) REFERENCES video_info(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_info_id ON video_summaries(video_info_id);

-- =============================================================================
-- STEP 3: Remove redundant fields and finalize structure
-- =============================================================================

-- Verify that all video_summaries have video_info_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM video_summaries 
    WHERE video_info_id IS NULL AND video_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Migration incomplete: Found video_summaries without video_info_id';
  END IF;
END $$;

-- Make video_info_id NOT NULL
ALTER TABLE video_summaries ALTER COLUMN video_info_id SET NOT NULL;

-- Fix dependencies before removing columns
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

-- Remove redundant columns from video_summaries
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_id;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_title;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_thumbnail;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_duration;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS channel_title;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_tags;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_description;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS dialog;

-- Add helpful comments
COMMENT ON TABLE video_summaries IS 'Stores summary data. Join with video_info for video metadata.';
COMMENT ON COLUMN video_summaries.video_info_id IS 'Foreign key to video_info table containing video metadata';

-- Create a view for backward compatibility
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

-- =============================================================================
-- STEP 4: Clean up redundant fields and update RPC functions
-- =============================================================================

-- Verify all data has been migrated properly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM video_summaries 
    WHERE video_info_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot proceed: Found video_summaries records without video_info_id';
  END IF;
  
  RAISE NOTICE 'Migration verification passed: All video_summaries have video_info_id';
END $$;

-- Clean up redundant fields from video_summaries
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_id CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_title CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS channel_title CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_thumbnail CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_duration CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_description CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_tags CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS dialog CASCADE;

-- Ensure video_info_id is NOT NULL
ALTER TABLE video_summaries ALTER COLUMN video_info_id SET NOT NULL;

-- Update table comments
COMMENT ON TABLE video_summaries IS 'Stores summary data. Video metadata is in video_info table via video_info_id foreign key.';
COMMENT ON COLUMN video_summaries.video_info_id IS 'Foreign key reference to video_info table containing video metadata and transcript';

-- Update the compatibility view
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

GRANT SELECT ON video_summaries_with_info TO authenticated;
GRANT SELECT ON video_summaries_with_info TO service_role;

-- Update RPC functions for new structure
DROP FUNCTION IF EXISTS summary_exists_for_language(VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION summary_exists_for_language(
    target_video_id VARCHAR(255),
    target_language VARCHAR(10)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM video_summaries vs
        JOIN video_info vi ON vs.video_info_id = vi.id
        WHERE vi.video_id = target_video_id 
        AND vs.language = target_language
    );
END;
$$;

GRANT EXECUTE ON FUNCTION summary_exists_for_language(VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION summary_exists_for_language(VARCHAR, VARCHAR) TO service_role;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_info_id ON video_summaries(video_info_id);
CREATE INDEX IF NOT EXISTS idx_video_summaries_user_id ON video_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_video_summaries_language ON video_summaries(language);
CREATE INDEX IF NOT EXISTS idx_video_summaries_created_at ON video_summaries(created_at);

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Verify the final structure
DO $$
DECLARE
  column_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns 
  WHERE table_name = 'video_summaries' 
  AND column_name IN ('video_id', 'video_title', 'channel_title', 'video_thumbnail', 'video_duration', 'video_description', 'video_tags', 'dialog');
  
  IF column_count > 0 THEN
    RAISE EXCEPTION 'Cleanup failed: Some redundant columns still exist in video_summaries';
  END IF;
  
  RAISE NOTICE 'Cleanup completed successfully: All redundant columns removed from video_summaries';
END $$;

-- Verify the migration by checking row counts
SELECT 
  'video_info' as table_name, 
  COUNT(*) as row_count,
  COUNT(DISTINCT video_id) as unique_videos
FROM video_info
UNION ALL
SELECT 
  'video_summaries' as table_name, 
  COUNT(*) as row_count,
  COUNT(DISTINCT video_info_id) as unique_video_refs
FROM video_summaries;