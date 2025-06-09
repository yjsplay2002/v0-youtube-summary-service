'use client';

import { useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/components/auth-context';

export function AuthErrorHandler() {
  const { signOut } = useAuth();

  useEffect(() => {
    const handleAuthError = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error && error.message.includes('refresh_token_not_found')) {
          console.log('Refresh token not found, clearing session...');
          // Clear local storage and sign out
          localStorage.removeItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
          await signOut();
        }
      } catch (err) {
        console.error('Error handling auth state:', err);
      }
    };

    // Listen for auth errors
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !session) {
        // Clear any remaining auth data
        localStorage.clear();
      }
    });

    // Check for auth errors on mount
    handleAuthError();

    return () => subscription.unsubscribe();
  }, [signOut]);

  return null;
}