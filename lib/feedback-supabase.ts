import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_FEEDBACK_SUPABASE_URL || 'https://dummy-feedback.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_FEEDBACK_SUPABASE_ANON_KEY || 'dummy_feedback_key_for_development'

export const feedbackSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: 'feedback-supabase-auth',
  },
})

export type FeedbackPost = {
  id: string
  user_id: string
  service_name: string
  title: string
  content: string
  upvotes: number
  downvotes: number
  created_at: string
  updated_at: string
  user_email?: string
  user_name?: string
  comment_count?: number
}

export type FeedbackComment = {
  id: string
  post_id: string
  user_id: string
  content: string
  upvotes: number
  downvotes: number
  created_at: string
  user_email?: string
  user_name?: string
}