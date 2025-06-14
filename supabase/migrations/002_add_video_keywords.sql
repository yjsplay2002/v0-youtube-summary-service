-- Add video keywords and topics to video_summaries table
ALTER TABLE video_summaries 
ADD COLUMN video_tags TEXT[], -- YouTube tags from API
ADD COLUMN video_description TEXT, -- YouTube description from API
ADD COLUMN inferred_topics TEXT[], -- AI-inferred topics from title, description, tags
ADD COLUMN inferred_keywords TEXT[]; -- AI-inferred keywords from title, description, tags

-- Create indexes for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_video_summaries_inferred_topics ON video_summaries USING GIN(inferred_topics);
CREATE INDEX IF NOT EXISTS idx_video_summaries_inferred_keywords ON video_summaries USING GIN(inferred_keywords);
CREATE INDEX IF NOT EXISTS idx_video_summaries_video_tags ON video_summaries USING GIN(video_tags);