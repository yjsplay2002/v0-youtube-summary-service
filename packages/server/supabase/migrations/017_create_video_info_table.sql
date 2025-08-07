-- Create video_info table to store video metadata and dialog
-- This separates video information from summaries to avoid data duplication

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