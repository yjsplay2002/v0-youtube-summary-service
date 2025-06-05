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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 일반 클라이언트 (RLS 적용됨)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
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
