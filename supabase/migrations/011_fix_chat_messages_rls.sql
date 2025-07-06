-- Fix RLS policies for chat_messages table to allow service role access
-- This migration adds policies that allow the service role to bypass RLS for chat operations

-- Drop existing policies to recreate them with service role support
DROP POLICY IF EXISTS "Users can view their own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert their own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own chat messages" ON chat_messages;

-- Policy: Users can view their own chat messages OR service role can view all
CREATE POLICY "Users can view their own chat messages" ON chat_messages
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Policy: Users can insert their own chat messages OR service role can insert any
CREATE POLICY "Users can insert their own chat messages" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Policy: Users can update their own chat messages OR service role can update any
CREATE POLICY "Users can update their own chat messages" ON chat_messages
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Policy: Users can delete their own chat messages OR service role can delete any
CREATE POLICY "Users can delete their own chat messages" ON chat_messages
  FOR DELETE USING (
    auth.uid() = user_id OR 
    auth.jwt() ->> 'role' = 'service_role'
  );