import {
  ApiResponse,
  Summary,
  VideoSummaryResponse,
  SummariesResponse,
  VideoLanguagesResponse,
  RagProcessRequest,
  RagProcessResponse,
  createApiResponse,
  withRetry,
  buildUrl
} from '@youtube-summary/shared';

export interface ApiClientConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
}

export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
  }

  private async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await withRetry(
        () => this.fetchWithTimeout(`${this.baseUrl}${endpoint}`, options),
        this.retries
      );

      const data = await response.json();

      if (!response.ok) {
        return createApiResponse<T>(undefined, data.error || `HTTP ${response.status}`);
      }

      return createApiResponse<T>(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return createApiResponse<T>(undefined, `Network error: ${message}`);
    }
  }

  async getSummaries(
    page: number = 1,
    limit: number = 20,
    userId?: string
  ): Promise<ApiResponse<SummariesResponse>> {
    const params: Record<string, string | number> = { page, limit };
    if (userId) params.userId = userId;
    
    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)])
    ).toString();
    
    return this.makeRequest<SummariesResponse>(`/api/summaries?${query}`);
  }

  async getVideoSummaryByLanguage(
    videoId: string,
    language: string
  ): Promise<ApiResponse<VideoSummaryResponse>> {
    const params = new URLSearchParams({ videoId, language });
    return this.makeRequest<VideoSummaryResponse>(`/api/video-summary-by-language?${params}`);
  }

  async getVideoLanguages(videoId: string): Promise<ApiResponse<VideoLanguagesResponse>> {
    const params = new URLSearchParams({ videoId });
    return this.makeRequest<VideoLanguagesResponse>(`/api/video-languages?${params}`);
  }

  async processVideoForRag(request: RagProcessRequest): Promise<ApiResponse<RagProcessResponse>> {
    return this.makeRequest<RagProcessResponse>('/api/rag/process-video', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async addToMySummaries(
    videoId: string,
    language: string,
    userId: string
  ): Promise<ApiResponse<any>> {
    return this.makeRequest('/api/add-to-my-summaries', {
      method: 'POST',
      body: JSON.stringify({ videoId, language, userId }),
    });
  }
}

// Default instance for convenience
export const apiClient = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
});