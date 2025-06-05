-- Create feedback_posts table
CREATE TABLE IF NOT EXISTS feedback_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_email VARCHAR(255),
  user_name VARCHAR(255)
);

-- Create feedback_comments table
CREATE TABLE IF NOT EXISTS feedback_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES feedback_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_email VARCHAR(255),
  user_name VARCHAR(255)
);

-- Create feedback_votes table for tracking user votes
CREATE TABLE IF NOT EXISTS feedback_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_id UUID REFERENCES feedback_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES feedback_comments(id) ON DELETE CASCADE,
  vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedback_posts_service_name ON feedback_posts(service_name);
CREATE INDEX IF NOT EXISTS idx_feedback_posts_created_at ON feedback_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_comments_post_id ON feedback_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user_id ON feedback_votes(user_id);

-- Enable Row Level Security
ALTER TABLE feedback_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY;

-- Policies for feedback_posts
CREATE POLICY "Anyone can read feedback posts" ON feedback_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert feedback posts" ON feedback_posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own posts" ON feedback_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON feedback_posts FOR DELETE USING (auth.uid() = user_id);

-- Policies for feedback_comments
CREATE POLICY "Anyone can read feedback comments" ON feedback_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert feedback comments" ON feedback_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update their own comments" ON feedback_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON feedback_comments FOR DELETE USING (auth.uid() = user_id);

-- Policies for feedback_votes
CREATE POLICY "Users can read their own votes" ON feedback_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert votes" ON feedback_votes FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
CREATE POLICY "Users can update their own votes" ON feedback_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own votes" ON feedback_votes FOR DELETE USING (auth.uid() = user_id);