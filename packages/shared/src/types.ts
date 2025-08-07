import { z } from 'zod';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Video Summary types
export interface Summary {
  video_id: string;
  title: string;
  thumbnail_url: string;
  channel_title: string;
  language: string;
  created_at: string;
  user_id?: string;
}

export interface VideoSummaryResponse {
  videoId: string;
  requestedLanguage: string;
  foundLanguage: string;
  summary: string;
  videoTitle: string;
  channelTitle: string;
  createdAt: string;
  meta: {
    timestamp: string;
  };
}

export interface SummariesResponse {
  summaries: Summary[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  meta: {
    userSpecific: boolean;
    timestamp: string;
  };
}

// Video Language types
export interface VideoLanguage {
  language: string;
  count: number;
}

export interface VideoLanguagesResponse {
  videoId: string;
  languages: VideoLanguage[];
  total: number;
  meta: {
    timestamp: string;
  };
}

// RAG Process types
export interface RagProcessRequest {
  videoId: string;
  userId?: string;
  overwrite?: boolean;
}

export interface RagProcessResponse {
  success: boolean;
  message: string;
  chunksStored: number;
  videoTitle: string;
}

// Validation schemas
export const VideoIdSchema = z.string().min(1, 'Video ID is required');
export const LanguageSchema = z.string().min(2, 'Language code must be at least 2 characters');
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Error types
export enum ApiErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: any;
}

// Utility functions
export function createApiResponse<T>(data?: T, error?: string): ApiResponse<T> {
  return {
    success: !error,
    data,
    error
  };
}

export function createApiError(code: ApiErrorCode, message: string, details?: any): ApiError {
  return {
    code,
    message,
    details
  };
}