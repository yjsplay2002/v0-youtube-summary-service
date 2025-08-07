-- Add dialog field to video_summaries table for conversational summary feature
ALTER TABLE video_summaries ADD COLUMN IF NOT EXISTS dialog TEXT;