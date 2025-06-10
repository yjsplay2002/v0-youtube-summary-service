import { User } from '@supabase/supabase-js';

export function isUserAdmin(user: User | null): boolean {
  if (!user) return false;
  
  // Check user metadata for admin role
  return user.user_metadata?.role === 'admin';
}

export function getAvailableModels(user: User | null): Array<{value: string, label: string}> {
  const isAdmin = isUserAdmin(user);
  
  if (isAdmin) {
    // Admin can use all models
    return [
      { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku (Fast)' },
      { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (Balanced)' },
      { value: 'claude-sonnet-4', label: 'Claude Sonnet 4 (Premium)' },
      { value: 'openai-gpt4', label: 'OpenAI GPT-4' }
    ];
  } else {
    // Regular users and guests can only use Haiku
    return [
      { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku' }
    ];
  }
}

export function getDefaultModel(user: User | null): string {
  // Everyone defaults to Haiku for cost efficiency
  return 'claude-3-5-haiku';
}