import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key_for_development';

// Only validate in production
if (process.env.NODE_ENV === 'production' && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  throw new Error('Missing required Supabase environment variables in production');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  console.log('Auth callback - URL:', requestUrl.toString());
  console.log('Auth callback - next parameter:', next);

  if (code) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('Error exchanging code for session:', error);
        return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`);
      }
    } catch (error) {
      console.error('Error in auth callback:', error);
      return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`);
    }
  }

  // URL to redirect to after sign in process completes
  const redirectUrl = new URL(next, requestUrl.origin).toString();
  console.log('Auth callback - redirecting to:', redirectUrl);
  return NextResponse.redirect(redirectUrl);
}