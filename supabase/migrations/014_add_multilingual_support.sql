-- Add multilingual support to video summaries
-- This migration adds language fields and user language preferences

-- 1. Add language field to video_summaries table
ALTER TABLE video_summaries 
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en' NOT NULL;

-- 2. Add index for language field for better query performance
CREATE INDEX IF NOT EXISTS idx_video_summaries_language ON video_summaries(language);

-- 3. Add composite index for video_id and language to support multiple language summaries per video
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_id_language ON video_summaries(video_id, language);

-- 4. Create user_preferences table to store user language preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_language VARCHAR(10) DEFAULT 'en' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure one preference row per user
  UNIQUE(user_id)
);

-- 5. Create indexes for user_preferences table
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- 6. Enable Row Level Security on user_preferences table
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for user_preferences table
CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- 8. Create trigger for user_preferences updated_at
CREATE TRIGGER update_user_preferences_updated_at 
  BEFORE UPDATE ON user_preferences 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Update existing summaries to have default language 'en'
UPDATE video_summaries 
SET language = 'en' 
WHERE language IS NULL;

-- 10. Create function to get user preferred language
CREATE OR REPLACE FUNCTION get_user_preferred_language(target_user_id UUID)
RETURNS VARCHAR(10)
SECURITY DEFINER
AS $$
DECLARE
  preferred_lang VARCHAR(10);
BEGIN
  SELECT preferred_language INTO preferred_lang
  FROM user_preferences
  WHERE user_id = target_user_id;
  
  -- Return default language if no preference found
  RETURN COALESCE(preferred_lang, 'en');
END;
$$ LANGUAGE plpgsql;

-- 11. Create function to set user preferred language
CREATE OR REPLACE FUNCTION set_user_preferred_language(target_user_id UUID, new_language VARCHAR(10))
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_preferences (user_id, preferred_language)
  VALUES (target_user_id, new_language)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    preferred_language = EXCLUDED.preferred_language,
    updated_at = NOW();
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 12. Update get_user_summaries function to include language information
-- First drop the existing function
DROP FUNCTION IF EXISTS get_user_summaries(UUID);

-- Then create the new function with updated return type
CREATE OR REPLACE FUNCTION get_user_summaries(target_user_id UUID)
RETURNS TABLE(
  video_id VARCHAR,
  video_title TEXT,
  video_thumbnail TEXT,
  channel_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  summary_id UUID,
  language VARCHAR(10)
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
    vs.id as summary_id,
    vs.language
  FROM video_summaries vs
  JOIN user_summaries us ON vs.id = us.summary_id
  WHERE us.user_id = target_user_id
  ORDER BY us.created_at DESC;
END;
$$ LANGUAGE plpgsql;