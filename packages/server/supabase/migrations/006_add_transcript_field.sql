-- Add transcript field to video_summaries table for storing original transcript data
ALTER TABLE video_summaries ADD COLUMN IF NOT EXISTS transcript TEXT;

-- Add index for better performance when searching by transcript availability
CREATE INDEX IF NOT EXISTS idx_video_summaries_transcript ON video_summaries(video_id) WHERE transcript IS NOT NULL;