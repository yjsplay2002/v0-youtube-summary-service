// YouTube URL utilities
export function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
    /^[a-zA-Z0-9_-]{11}$/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

export function extractVideoId(url: string): string | null {
  if (!url) return null;
  
  // If it's already an 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

// Language utilities
export function getLanguageName(code: string): string {
  const languageNames: Record<string, string> = {
    'en': 'English',
    'ko': '한국어',
    'ja': '日本語',
    'zh': '中文',
    'es': 'Español',
    'fr': 'Français',
    'de': 'Deutsch',
    'it': 'Italiano',
    'pt': 'Português',
    'ru': 'Русский',
    'ar': 'العربية',
    'hi': 'हिन्दी'
  };
  
  return languageNames[code] || code.toUpperCase();
}

// Date utilities
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Storage utilities
export function setStorageItem(key: string, value: any, ttl?: number): void {
  if (typeof window === 'undefined') return;
  
  const item = {
    value,
    timestamp: Date.now(),
    ttl: ttl ? Date.now() + ttl : null
  };
  
  try {
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.warn('Failed to set localStorage item:', error);
  }
}

export function getStorageItem<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    const parsed = JSON.parse(item);
    
    // Check if item has expired
    if (parsed.ttl && Date.now() > parsed.ttl) {
      localStorage.removeItem(key);
      return null;
    }
    
    return parsed.value;
  } catch (error) {
    console.warn('Failed to get localStorage item:', error);
    return null;
  }
}

export function removeStorageItem(key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to remove localStorage item:', error);
  }
}

// URL utilities
export function buildUrl(baseUrl: string, path: string, params?: Record<string, string | number>): string {
  const url = new URL(path, baseUrl);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }
  
  return url.toString();
}

// Retry utilities
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
    }
  }
  
  throw new Error('Max retries exceeded');
}