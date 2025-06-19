'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/app/lib/supabase';
import { AuthErrorHandler } from './auth-error-handler';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
        // Clear any invalid session data
        setSession(null);
        setUser(null);
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session);
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
        setSession(null);
        setUser(null);
      } else if (event === 'SIGNED_IN') {
        console.log('User signed in');
        setSession(session);
        setUser(session?.user ?? null);
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Supabase 공식 문서에 따른 URL 생성 함수
  const getURL = () => {
    let url = `${window.location.origin}/auth/callback`;

    // Ensure proper URL formatting
    url = url.startsWith('http') ? url : `https://${url}`;
    url = url.endsWith('/') ? url : `${url}/`;
    return url;
  };

  const signInWithGoogle = async (redirectPath?: string) => {
    try {
      const currentPath = redirectPath || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');
      
      // Supabase 권장 방식으로 base URL 생성
      const baseURL = getURL();
      const redirectTo = `${baseURL}`;
      
      console.log('Google OAuth 시작:', { 
        baseURL,
        redirectTo, 
        currentPath,
        env: process.env.NODE_ENV,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
        vercelUrl: process.env.NEXT_PUBLIC_VERCEL_URL
      });
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (error) {
        console.error('Google OAuth 오류:', error);
        console.error('사용된 redirectTo:', redirectTo);
        throw error;
      }
      
      console.log('Google OAuth 성공적으로 시작됨:', data);
    } catch (error) {
      console.error('signInWithGoogle 실행 중 오류:', error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      <AuthErrorHandler />
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}