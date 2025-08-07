-- Allow NULL user_id for guest users
-- This migration modifies the user_id column to allow NULL values for guest users

-- Drop the NOT NULL constraint on user_id column
ALTER TABLE video_summaries ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to handle guest users properly
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can insert their own summaries" ON video_summaries;
DROP POLICY IF EXISTS "Users can view all summaries" ON video_summaries;
DROP POLICY IF EXISTS "Users can update their own summaries" ON video_summaries;
DROP POLICY IF EXISTS "Users can delete their own summaries" ON video_summaries;

-- Create new policies that handle both authenticated users and guests
CREATE POLICY "Users can insert their own summaries or guest summaries" ON video_summaries
  FOR INSERT WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND user_id IS NULL)
  );

CREATE POLICY "Everyone can view all summaries" ON video_summaries
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own summaries" ON video_summaries
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND auth.uid() = user_id
  );

CREATE POLICY "Users can delete their own summaries" ON video_summaries
  FOR DELETE USING (
    auth.uid() IS NOT NULL AND auth.uid() = user_id
  );

-- Note: Guest summaries (user_id = NULL) can only be created, not updated or deleted by users