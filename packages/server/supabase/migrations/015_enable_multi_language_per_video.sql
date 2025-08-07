-- Enable multiple language summaries per video
-- This migration restructures the system to allow multiple summaries per video in different languages

-- 1. Add unique constraint for video_id + language combination
-- This ensures each video can have only one summary per language
ALTER TABLE video_summaries 
ADD CONSTRAINT unique_video_language_summary 
UNIQUE (video_id, language);

-- 2. Update existing indexes to support multi-language queries
-- Drop old indexes that don't consider language
DROP INDEX IF EXISTS idx_video_summaries_video_id;

-- Create new composite indexes for better performance
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_id_language ON video_summaries(video_id, language);
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_id_language_created ON video_summaries(video_id, language, created_at DESC);

-- 3. Create function to get summary with language fallback
-- Priority: requested language -> English -> any available language -> null
CREATE OR REPLACE FUNCTION get_summary_with_language_fallback(
  target_video_id VARCHAR(255),
  preferred_language VARCHAR(10) DEFAULT 'en'
)
RETURNS TABLE(
  id UUID,
  video_id VARCHAR(255),
  video_title TEXT,
  video_thumbnail TEXT,
  video_duration VARCHAR(50),
  channel_title TEXT,
  summary TEXT,
  language VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  user_id UUID,
  found_language VARCHAR(10),
  is_fallback BOOLEAN
)
SECURITY DEFINER
AS $$
DECLARE
  summary_record RECORD;
BEGIN
  -- First try to find summary in preferred language
  SELECT vs.* INTO summary_record
  FROM video_summaries vs
  WHERE vs.video_id = target_video_id 
  AND vs.language = preferred_language
  ORDER BY vs.created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY
    SELECT 
      summary_record.id,
      summary_record.video_id,
      summary_record.video_title,
      summary_record.video_thumbnail,
      summary_record.video_duration,
      summary_record.channel_title,
      summary_record.summary,
      summary_record.language,
      summary_record.created_at,
      summary_record.updated_at,
      summary_record.user_id,
      summary_record.language as found_language,
      false as is_fallback;
    RETURN;
  END IF;
  
  -- If preferred language not found, try English as fallback
  IF preferred_language != 'en' THEN
    SELECT vs.* INTO summary_record
    FROM video_summaries vs
    WHERE vs.video_id = target_video_id 
    AND vs.language = 'en'
    ORDER BY vs.created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
      RETURN QUERY
      SELECT 
        summary_record.id,
        summary_record.video_id,
        summary_record.video_title,
        summary_record.video_thumbnail,
        summary_record.video_duration,
        summary_record.channel_title,
        summary_record.summary,
        summary_record.language,
        summary_record.created_at,
        summary_record.updated_at,
        summary_record.user_id,
        summary_record.language as found_language,
        true as is_fallback;
      RETURN;
    END IF;
  END IF;
  
  -- If neither preferred language nor English found, try any available language
  SELECT vs.* INTO summary_record
  FROM video_summaries vs
  WHERE vs.video_id = target_video_id
  ORDER BY vs.created_at DESC
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY
    SELECT 
      summary_record.id,
      summary_record.video_id,
      summary_record.video_title,
      summary_record.video_thumbnail,
      summary_record.video_duration,
      summary_record.channel_title,
      summary_record.summary,
      summary_record.language,
      summary_record.created_at,
      summary_record.updated_at,
      summary_record.user_id,
      summary_record.language as found_language,
      true as is_fallback;
    RETURN;
  END IF;
  
  -- No summary found in any language
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to get all available languages for a video
CREATE OR REPLACE FUNCTION get_available_languages_for_video(target_video_id VARCHAR(255))
RETURNS TABLE(
  language VARCHAR(10),
  summary_count INTEGER,
  latest_created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vs.language,
    COUNT(*)::INTEGER as summary_count,
    MAX(vs.created_at) as latest_created_at
  FROM video_summaries vs
  WHERE vs.video_id = target_video_id
  GROUP BY vs.language
  ORDER BY vs.language;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to check if summary exists for specific video and language
CREATE OR REPLACE FUNCTION summary_exists_for_language(
  target_video_id VARCHAR(255),
  target_language VARCHAR(10)
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  summary_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO summary_count
  FROM video_summaries
  WHERE video_id = target_video_id 
  AND language = target_language;
  
  RETURN summary_count > 0;
END;
$$ LANGUAGE plpgsql;

-- 6. Update user summaries relationship to support multiple languages
-- Add language field to user_summaries for better tracking
ALTER TABLE user_summaries 
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en';

-- Create index for user summaries with language
CREATE INDEX IF NOT EXISTS idx_user_summaries_user_language ON user_summaries(user_id, preferred_language);

-- 7. Update get_user_summaries function to support multiple languages per video
DROP FUNCTION IF EXISTS get_user_summaries(UUID);

CREATE OR REPLACE FUNCTION get_user_summaries(target_user_id UUID)
RETURNS TABLE(
  video_id VARCHAR,
  video_title TEXT,
  video_thumbnail TEXT,
  channel_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  summary_id UUID,
  language VARCHAR(10),
  available_languages TEXT[]
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
    vs.language,
    ARRAY(
      SELECT DISTINCT vs2.language 
      FROM video_summaries vs2 
      WHERE vs2.video_id = vs.video_id 
      ORDER BY vs2.language
    ) as available_languages
  FROM video_summaries vs
  JOIN user_summaries us ON vs.id = us.summary_id
  WHERE us.user_id = target_user_id
  ORDER BY us.created_at DESC;
END;
$$ LANGUAGE plpgsql;