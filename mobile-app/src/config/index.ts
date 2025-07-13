// Configuration for the mobile app
export const config = {
  // Base URL for the web app's API endpoints
  // In production, this would be your deployed web app URL
  webAppBaseUrl: process.env.EXPO_PUBLIC_WEB_APP_URL || 'http://localhost:3000',
  
  // Supabase configuration
  supabase: {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  
  // App configuration
  app: {
    name: 'YouTube Summarizer',
    version: '1.0.0',
  },
}