import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabase';

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

  // Validate redirect URL to prevent open redirect attacks
  let redirectUrl: string;
  try {
    const nextUrl = new URL(next, requestUrl.origin);
    // Only allow redirects to the same origin
    if (nextUrl.origin === requestUrl.origin) {
      redirectUrl = nextUrl.toString();
    } else {
      redirectUrl = requestUrl.origin;
    }
  } catch {
    // If next is not a valid URL, default to home
    redirectUrl = requestUrl.origin;
  }

  console.log('Auth callback - redirecting to:', redirectUrl);
  return NextResponse.redirect(redirectUrl);
}