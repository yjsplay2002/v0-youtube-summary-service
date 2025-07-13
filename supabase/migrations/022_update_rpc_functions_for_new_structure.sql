-- Update RPC functions to work with the new normalized structure
-- where video metadata is in video_info table and summaries in video_summaries

-- 1. Update summary_exists_for_language function
DROP FUNCTION IF EXISTS summary_exists_for_language(VARCHAR, VARCHAR);

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
        FROM video_summaries vs
        JOIN video_info vi ON vs.video_info_id = vi.id
        WHERE vi.video_id = target_video_id 
        AND vs.language = target_language
    );
END;
$$;

COMMENT ON FUNCTION summary_exists_for_language(VARCHAR, VARCHAR) IS 
'Check if a summary exists for a specific video and language using the normalized structure';

-- 2. Update get_summaries_by_language function if it exists
DROP FUNCTION IF EXISTS get_summaries_by_language(VARCHAR, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_summaries_by_language(
    target_language VARCHAR(10) DEFAULT 'en',
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    video_id VARCHAR(255),
    video_title TEXT,
    channel_title TEXT,
    summary TEXT,
    language VARCHAR(10),
    created_at TIMESTAMPTZ,
    user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vs.id,
        vi.video_id,
        vi.video_title,
        vi.channel_title,
        vs.summary,
        vs.language,
        vs.created_at,
        vs.user_id
    FROM video_summaries vs
    JOIN video_info vi ON vs.video_info_id = vi.id
    WHERE vs.language = target_language
    ORDER BY vs.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$;

COMMENT ON FUNCTION get_summaries_by_language(VARCHAR, INTEGER, INTEGER) IS 
'Get summaries for a specific language using the normalized structure';

-- 3. Create helper function to get video summary with metadata
CREATE OR REPLACE FUNCTION get_video_summary_with_metadata(
    target_video_id VARCHAR(255),
    target_language VARCHAR(10) DEFAULT 'en',
    target_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    summary_id UUID,
    video_id VARCHAR(255),
    video_title TEXT,
    channel_title TEXT,
    video_thumbnail TEXT,
    summary TEXT,
    language VARCHAR(10),
    created_at TIMESTAMPTZ,
    user_id UUID,
    dialog TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vs.id,
        vi.video_id,
        vi.video_title,
        vi.channel_title,
        vi.video_thumbnail,
        vs.summary,
        vs.language,
        vs.created_at,
        vs.user_id,
        vi.dialog
    FROM video_summaries vs
    JOIN video_info vi ON vs.video_info_id = vi.id
    WHERE vi.video_id = target_video_id
    AND vs.language = target_language
    AND (target_user_id IS NULL OR vs.user_id = target_user_id OR vs.user_id IS NULL)
    ORDER BY 
        CASE WHEN vs.user_id = target_user_id THEN 1 ELSE 2 END,
        vs.created_at DESC
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_video_summary_with_metadata(VARCHAR, VARCHAR, UUID) IS 
'Get video summary with complete metadata using the normalized structure';

-- 4. Create function to get available languages for a video
CREATE OR REPLACE FUNCTION get_video_languages(
    target_video_id VARCHAR(255)
)
RETURNS TABLE(
    language VARCHAR(10),
    summary_count INTEGER,
    latest_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vs.language,
        COUNT(*)::INTEGER,
        MAX(vs.created_at)
    FROM video_summaries vs
    JOIN video_info vi ON vs.video_info_id = vi.id
    WHERE vi.video_id = target_video_id
    GROUP BY vs.language
    ORDER BY COUNT(*) DESC, MAX(vs.created_at) DESC;
END;
$$;

COMMENT ON FUNCTION get_video_languages(VARCHAR) IS 
'Get available languages for a specific video with summary counts';

-- Grant permissions
GRANT EXECUTE ON FUNCTION summary_exists_for_language(VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION summary_exists_for_language(VARCHAR, VARCHAR) TO service_role;

GRANT EXECUTE ON FUNCTION get_summaries_by_language(VARCHAR, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_summaries_by_language(VARCHAR, INTEGER, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION get_video_summary_with_metadata(VARCHAR, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_video_summary_with_metadata(VARCHAR, VARCHAR, UUID) TO service_role;

GRANT EXECUTE ON FUNCTION get_video_languages(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_video_languages(VARCHAR) TO service_role;