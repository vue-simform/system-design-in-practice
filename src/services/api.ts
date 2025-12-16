import type { FeedResponse, Post, Comment, CreatePostData } from '../types';
import { classifyError, retryWithBackoff, logError } from '../utils/errorHandling';

const API_BASE_URL = 'https://system-design-practical-production.up.railway.app/api';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// API Error Class
// ============================================================================

export class ApiError extends Error {
  statusCode: number;
  statusText: string;
  data?: any;

  constructor(statusCode: number, statusText: string, data?: any) {
    super(`API Error: ${statusCode} ${statusText}`);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.data = data;
  }
}

// ============================================================================
// Request Helper with Timeout
// ============================================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Response Handler with Error Classification
// ============================================================================

async function handleResponse<T>(response: Response, context?: string): Promise<T> {
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    const apiError = new ApiError(
      response.status,
      response.statusText,
      errorData
    );

    const appError = classifyError(apiError);
    logError(appError, { context, url: response.url });

    throw apiError;
  }

  try {
    return await response.json();
  } catch (error) {
    // Handle empty or invalid JSON responses
    return {} as T;
  }
}

/**
 * API service for news feed operations
 * This service handles all HTTP requests to the backend with retry logic and error handling
 */
export const feedApi = {
  /**
   * Fetch paginated feed posts with retry logic
   */
  async getFeed(cursor?: string, limit = 10): Promise<FeedResponse> {
    return retryWithBackoff(async () => {
      const params = new URLSearchParams();
      if (cursor) params.append('cursor', cursor);
      params.append('limit', limit.toString());
      
      const response = await fetchWithTimeout(`${API_BASE_URL}/feed?${params}`);
      return handleResponse<FeedResponse>(response, 'getFeed');
    });
  },

  /**
   * Get a single post by ID
   */
  async getPost(postId: string): Promise<Post> {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}`);
    if (!response.ok) throw new Error('Failed to fetch post');
    return response.json();
  },

  /**
   * Create a new post
   */
  async createPost(data: CreatePostData): Promise<Post> {
    const response = await fetch(`${API_BASE_URL}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create post');
    return response.json();
  },

  /**
   * Like a post with optimistic update support
   */
  async likePost(postId: string, userId: string): Promise<void> {
    return retryWithBackoff(async () => {
      const response = await fetchWithTimeout(`${API_BASE_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      await handleResponse(response, 'likePost');
    }, { maxAttempts: 2 }); // Fewer retries for user actions
  },

  /**
   * Unlike a post with optimistic update support
   */
  async unlikePost(postId: string, userId: string): Promise<void> {
    return retryWithBackoff(async () => {
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/posts/${postId}/like?userId=${userId}`,
        { method: 'DELETE' }
      );
      await handleResponse(response, 'unlikePost');
    }, { maxAttempts: 2 });
  },

  /**
   * Add a comment to a post
   */
  async addComment(postId: string, data: { text: string; userId: string; parentId?: string }): Promise<Comment> {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to add comment');
    return response.json();
  },

  /**
   * Get comments for a post
   */
  async getComments(postId: string): Promise<Comment[]> {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments`);
    if (!response.ok) throw new Error('Failed to fetch comments');
    return response.json();
  },

  /**
   * Search posts with filters and sorting
   * @param query - Search query string
   * @param filter - Filter type: 'all' | 'following' | 'liked'
   * @param sort - Sort order: 'newest' | 'popular' | 'trending'
   * @param cursor - Pagination cursor
   * @param limit - Number of results per page
   */
  async searchPosts(
    query: string,
    filter: 'all' | 'following' | 'liked' = 'all',
    sort: 'newest' | 'popular' | 'trending' = 'newest',
    cursor?: string,
    limit = 20
  ): Promise<FeedResponse> {
    const params = new URLSearchParams();
    params.append('q', query);
    params.append('filter', filter);
    params.append('sort', sort);
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());
    
    const response = await fetch(`${API_BASE_URL}/search?${params}`);
    if (!response.ok) throw new Error('Failed to search posts');
    return response.json();
  },

  /**
   * Get user profile by ID
   * @param userId - The user ID to fetch
   */
  async getUserProfile(userId: string) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found');
      }
      throw new Error('Failed to fetch user profile');
    }
    return response.json();
  },

  /**
   * Get posts by a specific user
   * @param userId - The user ID whose posts to fetch
   * @param cursor - Pagination cursor
   * @param limit - Number of posts per page
   */
  async getUserPosts(userId: string, cursor?: string, limit = 10): Promise<FeedResponse> {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}/posts?${params}`);
    if (!response.ok) throw new Error('Failed to fetch user posts');
    return response.json();
  },

  /**
   * Follow a user
   * @param userId - The user ID to follow
   */
  async followUser(userId: string) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'follow' }),
    });
    if (!response.ok) throw new Error('Failed to follow user');
    return response.json();
  },

  /**
   * Unfollow a user
   * @param userId - The user ID to unfollow
   */
  async unfollowUser(userId: string) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unfollow' }),
    });
    if (!response.ok) throw new Error('Failed to unfollow user');
    return response.json();
  },

  // ============================================================================
  // ANALYTICS API METHODS
  // ============================================================================

  /**
   * Get analytics overview metrics for a specific period
   * @param period - Time period: '7d', '30d', or '90d'
   */
  async getAnalyticsOverview(period: '7d' | '30d' | '90d' = '7d') {
    const response = await fetch(`${API_BASE_URL}/analytics/overview?period=${period}`);
    if (!response.ok) throw new Error('Failed to fetch analytics overview');
    return response.json();
  },

  /**
   * Get engagement time series data
   * @param period - Time period: '7d', '30d', or '90d'
   */
  async getEngagementTimeSeries(period: '7d' | '30d' | '90d' = '7d') {
    const response = await fetch(`${API_BASE_URL}/analytics/engagement?period=${period}`);
    if (!response.ok) throw new Error('Failed to fetch engagement data');
    return response.json();
  },

  /**
   * Get top performing posts
   * @param period - Time period: '7d', '30d', or '90d'
   * @param limit - Number of posts to return (default: 10)
   */
  async getTopPosts(period: '7d' | '30d' | '90d' = '7d', limit = 10) {
    const response = await fetch(`${API_BASE_URL}/analytics/posts/top?period=${period}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch top posts');
    return response.json();
  },

  /**
   * Get user activity data
   * @param period - Time period: '7d', '30d', or '90d'
   */
  async getUserActivity(period: '7d' | '30d' | '90d' = '7d') {
    const response = await fetch(`${API_BASE_URL}/analytics/activity?period=${period}`);
    if (!response.ok) throw new Error('Failed to fetch user activity');
    return response.json();
  },

  /**
   * Export analytics data
   * @param period - Time period: '7d', '30d', or '90d'
   * @param format - Export format: 'json' or 'csv'
   */
  async exportAnalytics(period: '7d' | '30d' | '90d' = '7d', format: 'json' | 'csv' = 'json') {
    const response = await fetch(`${API_BASE_URL}/analytics/export?period=${period}&format=${format}`);
    if (!response.ok) throw new Error('Failed to export analytics');
    return response.json();
  },
};
