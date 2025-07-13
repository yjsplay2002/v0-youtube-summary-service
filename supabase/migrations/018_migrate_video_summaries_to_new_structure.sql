-- Migrate existing video_summaries data to new structure with video_info table
-- This migration script safely moves video metadata to video_info table

-- Step 1: Create video_info_id column in video_summaries (nullable for now)
ALTER TABLE video_summaries ADD COLUMN IF NOT EXISTS video_info_id UUID;

-- Step 2: Migrate unique video data to video_info table
-- Insert unique video records from video_summaries to video_info
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

-- Step 3: Update video_summaries to reference video_info
UPDATE video_summaries 
SET video_info_id = vi.id
FROM video_info vi
WHERE video_summaries.video_id = vi.video_id;

-- Step 4: Add foreign key constraint
ALTER TABLE video_summaries 
ADD CONSTRAINT fk_video_summaries_video_info 
FOREIGN KEY (video_info_id) REFERENCES video_info(id) ON DELETE CASCADE;

-- Step 5: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_info_id ON video_summaries(video_info_id);

-- Note: We'll remove the redundant columns in the next migration after confirming everything works
-- For now, keep both old and new columns to ensure data integrity during transition