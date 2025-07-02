import { User } from '@supabase/supabase-js';

export type SubscriptionTier = 'free' | 'pro' | 'pro_plus' | 'admin';

export function isUserAdmin(user: User | null): boolean {
  if (!user) return false;
  
  // Check user metadata for admin role
  return user.user_metadata?.role === 'admin';
}

// Async version that accepts user ID (for backward compatibility)
export async function isUserAdminById(userId: string): Promise<boolean> {
  // This function should not be used since we don't have access to user metadata via ID
  // Always return false and rely on the synchronous version with the user object
  return false;
}

export function getUserSubscriptionTier(user: User | null): SubscriptionTier {
  if (!user) return 'free';
  
  // Admin has highest access
  if (isUserAdmin(user)) return 'admin';
  
  // Check subscription tier from user metadata or database
  const tier = user.user_metadata?.subscription_tier;
  
  if (tier === 'pro_plus') return 'pro_plus';
  if (tier === 'pro') return 'pro';
  
  return 'free';
}

export function getAvailableModels(user: User | null): string[] {
  const tier = getUserSubscriptionTier(user);
  
  switch (tier) {
    case 'admin':
      // Admin can use all models
      return ['gemini-2.5-flash', 'claude-3-5-haiku', 'claude-3-5-sonnet', 'claude-sonnet-4', 'openai-gpt4'];
    case 'pro_plus':
      // Pro+ can use premium models
      return ['gemini-2.5-flash', 'claude-3-5-haiku', 'claude-3-5-sonnet', 'claude-sonnet-4'];
    case 'pro':
      // Pro can use balanced models
      return ['gemini-2.5-flash', 'claude-3-5-haiku', 'claude-3-5-sonnet'];
    case 'free':
    default:
      // Free users can use Gemini and basic Claude model
      return ['gemini-2.5-flash', 'claude-3-5-haiku'];
  }
}

export function getDefaultModel(user: User | null): string {
  // Everyone defaults to Gemini for cost efficiency
  return 'gemini-2.5-flash';
}

export function getSubscriptionLimits(tier: SubscriptionTier) {
  switch (tier) {
    case 'admin':
      return {
        summariesPerDay: -1, // Unlimited
        promptTypes: ['general_summary', 'discussion_format', 'detailed_analysis'],
        maxVideoLength: -1, // Unlimited
        priority: 'highest'
      };
    case 'pro_plus':
      return {
        summariesPerDay: 100,
        promptTypes: ['general_summary', 'discussion_format', 'detailed_analysis'],
        maxVideoLength: 10800, // 3 hours
        priority: 'high'
      };
    case 'pro':
      return {
        summariesPerDay: 25,
        promptTypes: ['general_summary', 'discussion_format'],
        maxVideoLength: 3600, // 1 hour
        priority: 'normal'
      };
    case 'free':
    default:
      return {
        summariesPerDay: 3,
        promptTypes: ['general_summary'],
        maxVideoLength: 1800, // 30 minutes
        priority: 'low'
      };
  }
}