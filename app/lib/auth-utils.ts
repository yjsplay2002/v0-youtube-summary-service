import { User } from '@supabase/supabase-js';

export type SubscriptionTier = 'free' | 'pro' | 'pro_plus' | 'admin';

export function isUserAdmin(user: User | null): boolean {
  if (!user) return false;
  
  // Check user metadata for admin role
  return user.user_metadata?.role === 'admin';
}

export function getUserSubscriptionTier(user: User | null): SubscriptionTier {
  if (!user) return 'free';
  
  // Check if user is admin first
  if (isUserAdmin(user)) return 'admin';
  
  // Check user metadata for subscription tier
  const tier = user.user_metadata?.subscription_tier;
  if (tier === 'pro' || tier === 'pro_plus') {
    return tier;
  }
  
  return 'free';
}

export function getAvailableModels(user: User | null): Array<{value: string, label: string}> {
  const tier = getUserSubscriptionTier(user);
  
  switch (tier) {
    case 'admin':
    case 'pro_plus':
      // Pro+ and Admin can use all models
      return [
        { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku (Fast)' },
        { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (Balanced)' },
        { value: 'claude-sonnet-4', label: 'Claude Sonnet 4 (Premium)' },
        { value: 'openai-gpt4', label: 'OpenAI GPT-4' }
      ];
    case 'pro':
      // Pro can use Haiku and Sonnet
      return [
        { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku (Fast)' },
        { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet (Balanced)' }
      ];
    case 'free':
    default:
      // Free users can only use Haiku
      return [
        { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku' }
      ];
  }
}

export function getDefaultModel(user: User | null): string {
  // Everyone defaults to Haiku for cost efficiency
  return 'claude-3-5-haiku';
}

export function getMonthlyLimit(user: User | null): number {
  const tier = getUserSubscriptionTier(user);
  
  switch (tier) {
    case 'admin':
    case 'pro_plus':
      return -1; // Unlimited
    case 'pro':
      return 100;
    case 'free':
    default:
      return 5;
  }
}

export function getMaxVideoLength(user: User | null): number {
  const tier = getUserSubscriptionTier(user);
  
  switch (tier) {
    case 'admin':
    case 'pro_plus':
      return -1; // No limit
    case 'pro':
      return 120; // 2 hours in minutes
    case 'free':
    default:
      return 30; // 30 minutes
  }
}

export function canAccessFeature(user: User | null, feature: string): boolean {
  const tier = getUserSubscriptionTier(user);
  
  switch (feature) {
    case 'priority_processing':
      return tier === 'pro' || tier === 'pro_plus' || tier === 'admin';
    case 'custom_templates':
      return tier === 'pro' || tier === 'pro_plus' || tier === 'admin';
    case 'export_formats':
      return tier === 'pro' || tier === 'pro_plus' || tier === 'admin';
    case 'analytics':
      return tier === 'pro_plus' || tier === 'admin';
    case 'api_access':
      return tier === 'pro_plus' || tier === 'admin';
    case 'team_features':
      return tier === 'pro_plus' || tier === 'admin';
    case 'advanced_support':
      return tier === 'pro_plus' || tier === 'admin';
    default:
      return true; // Basic features available to all
  }
}