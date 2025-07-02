-- Remove transcript field and index since we already have dialog field
DROP INDEX IF EXISTS idx_video_summaries_transcript;
ALTER TABLE video_summaries DROP COLUMN IF EXISTS transcript;