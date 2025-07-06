-- Refactor video summaries structure to support multiple users per summary
-- This migration creates a many-to-many relationship between users and summaries

-- 1. Create user_summaries junction table
CREATE TABLE IF NOT EXISTS user_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_id UUID REFERENCES video_summaries(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Unique constraint to prevent duplicate entries
  UNIQUE(user_id, summary_id)
);

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_summaries_user_id ON user_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_summaries_summary_id ON user_summaries(summary_id);
CREATE INDEX IF NOT EXISTS idx_user_summaries_created_at ON user_summaries(created_at DESC);

-- 3. Enable Row Level Security on the new table
ALTER TABLE user_summaries ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for user_summaries table
CREATE POLICY "Users can insert their own summary connections" ON user_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Everyone can view summary connections" ON user_summaries
  FOR SELECT USING (true);

CREATE POLICY "Users can delete their own summary connections" ON user_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Migrate existing data to the new structure
-- First, update video_summaries to remove user_id constraint and make it nullable temporarily
-- We'll keep user_id for backward compatibility during transition

-- Insert existing user-summary relationships into the junction table
INSERT INTO user_summaries (user_id, summary_id, created_at)
SELECT 
  vs.user_id,
  vs.id,
  vs.created_at
FROM video_summaries vs
WHERE vs.user_id IS NOT NULL
ON CONFLICT (user_id, summary_id) DO NOTHING;

-- 6. Create a function to get summaries for a user
CREATE OR REPLACE FUNCTION get_user_summaries(target_user_id UUID)
RETURNS TABLE(
  video_id VARCHAR,
  video_title TEXT,
  video_thumbnail TEXT,
  channel_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  summary_id UUID
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vs.video_id,
    vs.video_title,
    vs.video_thumbnail,
    vs.channel_title,
    us.created_at,
    vs.id as summary_id
  FROM video_summaries vs
  JOIN user_summaries us ON vs.id = us.summary_id
  WHERE us.user_id = target_user_id
  ORDER BY us.created_at DESC;
END;
$$ LANGUAGE plpgsql;