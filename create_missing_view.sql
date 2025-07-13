-- Create the missing video_summaries_with_info view
-- This view provides backward compatibility with the old structure

CREATE OR REPLACE VIEW video_summaries_with_info AS
SELECT 
  vs.id,
  vs.user_id,
  vi.video_id,
  vi.video_title,
  vi.video_thumbnail,
  vi.video_duration,
  vi.channel_title,
  vi.video_tags,
  vi.video_description,
  vs.inferred_topics,
  vs.inferred_keywords,
  vs.summary,
  vs.summary_prompt,
  vi.dialog,
  vs.language,
  vs.video_info_id,
  vs.created_at,
  vs.updated_at
FROM video_summaries vs
JOIN video_info vi ON vs.video_info_id = vi.id;

-- Grant appropriate permissions to the view
GRANT SELECT ON video_summaries_with_info TO authenticated;
GRANT SELECT ON video_summaries_with_info TO service_role;