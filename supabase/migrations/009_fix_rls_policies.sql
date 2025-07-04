-- Temporarily disable RLS for debugging (DO NOT USE IN PRODUCTION)
-- This should only be used for debugging and should be reverted

-- Check current RLS status
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'video_summaries';

-- Option 1: Add a more permissive policy for service role
CREATE POLICY "Service role can access all summaries" ON video_summaries
  FOR ALL USING (auth.role() = 'service_role');

-- Option 2: Create a function to bypass RLS for debugging
CREATE OR REPLACE FUNCTION debug_get_all_summaries(user_id_param UUID DEFAULT NULL)
RETURNS TABLE (
  video_id TEXT,
  title TEXT,
  thumbnail_url TEXT,
  channel_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
AS $$
  SELECT 
    vs.video_id::TEXT,
    vs.video_title AS title,
    vs.video_thumbnail AS thumbnail_url,
    vs.channel_title,
    vs.created_at
  FROM video_summaries vs
  WHERE (user_id_param IS NULL OR vs.user_id = user_id_param)
  ORDER BY vs.created_at DESC
  LIMIT CASE WHEN user_id_param IS NULL THEN 20 ELSE NULL END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION debug_get_all_summaries TO authenticated, service_role;