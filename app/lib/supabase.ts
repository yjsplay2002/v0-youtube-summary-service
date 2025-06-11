import { createClient } from '@supabase/supabase-js';

export interface VideoSummary {
  id: string;
  user_id: string;
  video_id: string;
  video_title: string;
  video_thumbnail?: string;
  video_duration?: string;
  summary: string;
  summary_prompt?: string;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      video_summaries: {
        Row: VideoSummary;
        Insert: Omit<VideoSummary, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VideoSummary, 'id' | 'created_at' | 'updated_at'>>;
      };
    };
  };
}

// 환경변수에 아래 값이 반드시 있어야 합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key_for_development';

// Only validate in production or if not using dummy values
if (process.env.NODE_ENV === 'production' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  console.error('Missing required Supabase environment variables in production:');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  throw new Error('Missing required Supabase environment variables. Please check your .env.local file.');
}

// 일반 클라이언트 (RLS 적용됨)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    headers: {
      'x-application-name': 'youtube-summarizer',
    },
  },
});

// 관리자 클라이언트 (RLS 우회) - 서버 액션에서만 사용해야 함
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
