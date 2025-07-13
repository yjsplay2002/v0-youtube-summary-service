-- Add video_id column back to video_summaries for simpler queries
-- This migration adds video_id column and populates it from video_info table

-- Step 1: Add video_id column to video_summaries (if not exists)
ALTER TABLE video_summaries 
ADD COLUMN IF NOT EXISTS video_id TEXT;

-- Step 2: Populate video_id from video_info table for existing records
UPDATE video_summaries 
SET video_id = vi.video_id
FROM video_info vi 
WHERE video_summaries.video_info_id = vi.id 
AND video_summaries.video_id IS NULL;

-- Step 3: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_id ON video_summaries(video_id);

-- Step 4: Add constraint to ensure video_id is not null for new records
-- (We'll make it NOT NULL after ensuring all existing records have video_id)
-- ALTER TABLE video_summaries ALTER COLUMN video_id SET NOT NULL;

-- Verification query (optional - you can run this to check)
-- SELECT 
--   COUNT(*) as total_summaries,
--   COUNT(video_id) as summaries_with_video_id,
--   COUNT(video_info_id) as summaries_with_video_info_id
-- FROM video_summaries;