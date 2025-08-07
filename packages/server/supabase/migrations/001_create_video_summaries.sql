-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create video_summaries table
CREATE TABLE IF NOT EXISTS video_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_id VARCHAR(255) NOT NULL,
  video_title TEXT NOT NULL,
  video_thumbnail TEXT,
  video_duration VARCHAR(50),
  summary TEXT NOT NULL,
  summary_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_video_summaries_user_id ON video_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_id ON video_summaries(video_id);
CREATE INDEX IF NOT EXISTS idx_video_summaries_created_at ON video_summaries(created_at DESC);

-- Enable Row Level Security on the table
ALTER TABLE video_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies for RLS
CREATE POLICY "Users can insert their own summaries" ON video_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view all summaries" ON video_summaries
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own summaries" ON video_summaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own summaries" ON video_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_video_summaries_updated_at 
  BEFORE UPDATE ON video_summaries 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();