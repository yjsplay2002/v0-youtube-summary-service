-- Clean up redundant fields from video_summaries table
-- Remove fields that are now stored in video_info table

-- Step 1: Verify all data has been migrated properly
-- Check that all video_summaries have valid video_info_id
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

-- Step 2: Create backup view before dropping columns (for safety)
CREATE OR REPLACE VIEW video_summaries_backup_pre_cleanup AS
SELECT 
  vs.*,
  vi.video_id as vi_video_id,
  vi.video_title as vi_video_title,
  vi.channel_title as vi_channel_title,
  vi.video_thumbnail as vi_video_thumbnail,
  vi.video_duration as vi_video_duration,
  vi.video_description as vi_video_description,
  vi.video_tags as vi_video_tags,
  vi.dialog as vi_dialog
FROM video_summaries vs
LEFT JOIN video_info vi ON vs.video_info_id = vi.id;

-- Step 3: Drop redundant columns that are now in video_info
-- These fields are duplicated and should be accessed via video_info join

-- Remove video metadata fields (now in video_info)
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_id CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_title CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS channel_title CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_thumbnail CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_duration CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_description CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS video_tags CASCADE;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS dialog CASCADE;

-- Step 4: Ensure video_info_id is NOT NULL (should be set already)
ALTER TABLE video_summaries ALTER COLUMN video_info_id SET NOT NULL;

-- Step 5: Update table comments for clarity
COMMENT ON TABLE video_summaries IS 'Stores summary data. Video metadata is in video_info table via video_info_id foreign key.';
COMMENT ON COLUMN video_summaries.video_info_id IS 'Foreign key reference to video_info table containing video metadata and transcript';

-- Step 6: Update the compatibility view to use proper joins
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

-- Grant permissions to the updated view
GRANT SELECT ON video_summaries_with_info TO authenticated;
GRANT SELECT ON video_summaries_with_info TO service_role;

-- Step 7: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_info_id ON video_summaries(video_info_id);
CREATE INDEX IF NOT EXISTS idx_video_summaries_user_id ON video_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_video_summaries_language ON video_summaries(language);
CREATE INDEX IF NOT EXISTS idx_video_summaries_created_at ON video_summaries(created_at);

-- Step 8: Verify final structure
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

-- Step 9: Drop the backup view (optional - uncomment if you want to remove it)
-- DROP VIEW IF EXISTS video_summaries_backup_pre_cleanup;