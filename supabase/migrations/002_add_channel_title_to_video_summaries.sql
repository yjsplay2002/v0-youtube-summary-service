-- Add channel_title column to video_summaries table
ALTER TABLE video_summaries ADD COLUMN IF NOT EXISTS channel_title TEXT;