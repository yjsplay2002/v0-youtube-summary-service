-- Fix multi-language structure to properly support one record per video per language
-- This migration corrects the implementation to ensure videos can have multiple language-specific summaries

-- 1. First, let's see what we have and prepare for restructuring
-- Check if we have duplicate video_id + language combinations
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT video_id, language, COUNT(*) as cnt
        FROM video_summaries
        GROUP BY video_id, language
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate video_id + language combinations', duplicate_count;
        
        -- Keep only the most recent record for each video_id + language combination
        DELETE FROM video_summaries
        WHERE id NOT IN (
            SELECT DISTINCT ON (video_id, language) id
            FROM video_summaries
            ORDER BY video_id, language, created_at DESC
        );
        
        RAISE NOTICE 'Removed duplicate records, keeping the most recent for each video + language';
    END IF;
END $$;

-- 2. Now safely add the unique constraint
-- This will prevent duplicate video_id + language combinations in the future
ALTER TABLE video_summaries 
DROP CONSTRAINT IF EXISTS unique_video_language_summary;

ALTER TABLE video_summaries 
ADD CONSTRAINT unique_video_language_summary 
UNIQUE (video_id, language);

-- 3. Update indexes for better performance with multi-language queries
-- Drop old single-column index if it exists
DROP INDEX IF EXISTS idx_video_summaries_video_id;

-- Create optimized composite indexes
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_id_language ON video_summaries(video_id, language);
CREATE INDEX IF NOT EXISTS idx_video_summaries_language_created ON video_summaries(language, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_summaries_user_language ON video_summaries(user_id, language);

-- 4. Drop existing functions if they exist and create new ones
DROP FUNCTION IF EXISTS get_video_summary_with_fallback(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS get_summary_with_language_fallback(VARCHAR, VARCHAR);

-- Create function to get summary with language fallback
CREATE OR REPLACE FUNCTION get_video_summary_with_fallback(
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
    is_fallback BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Try preferred language first
    RETURN QUERY
    SELECT 
        vs.id,
        vs.video_id,
        vs.video_title,
        vs.video_thumbnail,
        vs.video_duration,
        vs.channel_title,
        vs.summary,
        vs.language,
        vs.created_at,
        vs.updated_at,
        vs.user_id,
        false as is_fallback
    FROM video_summaries vs
    WHERE vs.video_id = target_video_id 
    AND vs.language = preferred_language
    LIMIT 1;
    
    -- If we found a record, return it
    IF FOUND THEN
        RETURN;
    END IF;
    
    -- If preferred language not found and it's not English, try English
    IF preferred_language != 'en' THEN
        RETURN QUERY
        SELECT 
            vs.id,
            vs.video_id,
            vs.video_title,
            vs.video_thumbnail,
            vs.video_duration,
            vs.channel_title,
            vs.summary,
            vs.language,
            vs.created_at,
            vs.updated_at,
            vs.user_id,
            true as is_fallback
        FROM video_summaries vs
        WHERE vs.video_id = target_video_id 
        AND vs.language = 'en'
        LIMIT 1;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;
    
    -- If neither preferred nor English found, return any available language
    RETURN QUERY
    SELECT 
        vs.id,
        vs.video_id,
        vs.video_title,
        vs.video_thumbnail,
        vs.video_duration,
        vs.channel_title,
        vs.summary,
        vs.language,
        vs.created_at,
        vs.updated_at,
        vs.user_id,
        true as is_fallback
    FROM video_summaries vs
    WHERE vs.video_id = target_video_id
    ORDER BY vs.created_at DESC
    LIMIT 1;
END;
$$;

-- 5. Drop existing function if it exists and create new one
DROP FUNCTION IF EXISTS get_available_languages_for_video(VARCHAR);

-- Create function to get all available languages for a video
CREATE OR REPLACE FUNCTION get_available_languages_for_video(target_video_id VARCHAR(255))
RETURNS TABLE(
    language VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE,
    summary_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vs.language,
        vs.created_at,
        vs.id as summary_id
    FROM video_summaries vs
    WHERE vs.video_id = target_video_id
    ORDER BY vs.language;
END;
$$;

-- 6. Drop existing function if it exists and create new one
DROP FUNCTION IF EXISTS summary_exists_for_language(VARCHAR, VARCHAR);

-- Create function to check if summary exists for specific video and language
CREATE OR REPLACE FUNCTION summary_exists_for_language(
    target_video_id VARCHAR(255),
    target_language VARCHAR(10)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM video_summaries
        WHERE video_id = target_video_id 
        AND language = target_language
    );
END;
$$;

-- 7. Drop existing function if it exists and create new one
DROP FUNCTION IF EXISTS get_summaries_by_language(VARCHAR, INTEGER, INTEGER);

-- Create function to get summaries for a specific language
CREATE OR REPLACE FUNCTION get_summaries_by_language(
    target_language VARCHAR(10) DEFAULT 'en',
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
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
    user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vs.id,
        vs.video_id,
        vs.video_title,
        vs.video_thumbnail,
        vs.video_duration,
        vs.channel_title,
        vs.summary,
        vs.language,
        vs.created_at,
        vs.user_id
    FROM video_summaries vs
    WHERE vs.language = target_language
    ORDER BY vs.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$;

-- 8. Drop existing function if it exists and create new one
DROP FUNCTION IF EXISTS get_user_summaries(UUID);

-- Update get_user_summaries to properly handle multiple languages per video
CREATE OR REPLACE FUNCTION get_user_summaries(target_user_id UUID)
RETURNS TABLE(
    video_id VARCHAR(255),
    video_title TEXT,
    video_thumbnail TEXT,
    channel_title TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    summary_id UUID,
    language VARCHAR(10),
    available_languages TEXT[]
) 
LANGUAGE plpgsql
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
$$;

-- 9. Drop existing function if it exists and create new one
DROP FUNCTION IF EXISTS get_video_language_stats();

-- Create a function to get video statistics by language
CREATE OR REPLACE FUNCTION get_video_language_stats()
RETURNS TABLE(
    language VARCHAR(10),
    summary_count BIGINT,
    unique_videos BIGINT,
    latest_summary TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vs.language,
        COUNT(*) as summary_count,
        COUNT(DISTINCT vs.video_id) as unique_videos,
        MAX(vs.created_at) as latest_summary
    FROM video_summaries vs
    GROUP BY vs.language
    ORDER BY summary_count DESC;
END;
$$;

-- 10. Add comments to document the new structure
COMMENT ON CONSTRAINT unique_video_language_summary ON video_summaries IS 
'Ensures each video can have only one summary per language, enabling multi-language support';

COMMENT ON FUNCTION get_video_summary_with_fallback(VARCHAR, VARCHAR) IS 
'Returns summary for a video in preferred language with fallback to English, then any available language';

COMMENT ON FUNCTION get_available_languages_for_video(VARCHAR) IS 
'Returns all languages available for a specific video';

COMMENT ON FUNCTION summary_exists_for_language(VARCHAR, VARCHAR) IS 
'Checks if a summary exists for a specific video in a specific language';

COMMENT ON FUNCTION get_summaries_by_language(VARCHAR, INTEGER, INTEGER) IS 
'Returns paginated summaries filtered by language';

COMMENT ON FUNCTION get_video_language_stats() IS 
'Returns statistics about video summaries grouped by language';