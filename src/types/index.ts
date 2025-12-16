// Type definitions for the News Feed application

export interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  bio?: string;
}

export interface Post {
  id: string;
  content: string;
  authorId: string;
  author?: User;
  mediaUrls?: string[];
  likes?: Like[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  user?: User;
  text: string;
  parentId?: string | null;
  replies?: Comment[];
  replyCount?: number;
  likeCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CommentsResponse {
  comments: Comment[];
  total: number;
}

export interface CreateCommentData {
  postId: string;
  userId: string;
  text: string;
  parentId?: string | null;
}

export interface Like {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}

export interface FeedResponse {
  posts: Post[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface CreatePostData {
  content: string;
  authorId: string;
  mediaUrls?: string[];
}

export interface UpdatePostData {
  content?: string;
}

// Post Creation Types
export interface PostDraft {
  content: string;
  mediaUrls: string[];
  lastSaved: string;
}

export interface ImageFile {
  id: string;
  file: File;
  preview: string;
  size: number;
  type: string;
}

export interface PostFormValidation {
  isValid: boolean;
  errors: {
    content?: string;
    media?: string;
  };
}

export const POST_VALIDATION_RULES = {
  MAX_CONTENT_LENGTH: 2000,
  MAX_IMAGES: 4,
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
} as const;

// Profile Types
export interface UserProfile extends User {
  bio: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isFollowing?: boolean;
  joinedAt: string;
}

export interface UserProfileResponse {
  user: UserProfile;
}

export interface UserPostsResponse {
  posts: Post[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface FollowResponse {
  success: boolean;
  followerCount: number;
  isFollowing: boolean;
}

// Analytics Types
export type AnalyticsPeriod = '7d' | '30d' | '90d';

export type MetricType = 'likes' | 'comments' | 'shares' | 'views' | 'engagement';

export interface MetricValue {
  value: number;
  change: number; // Percentage change from previous period
  changeDirection: 'up' | 'down' | 'neutral';
}

export interface EngagementMetrics {
  totalLikes: MetricValue;
  totalComments: MetricValue;
  totalShares: MetricValue;
  totalViews: MetricValue;
  engagementRate: MetricValue; // (likes + comments + shares) / views
  reach: MetricValue; // Unique users who saw content
  impressions: MetricValue; // Total views including repeats
}

export interface TimeSeriesDataPoint {
  date: string; // ISO date string
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagement: number;
}

export interface EngagementTimeSeriesResponse {
  data: TimeSeriesDataPoint[];
  period: AnalyticsPeriod;
  summary: {
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalViews: number;
    avgEngagement: number;
  };
}

export interface TopPost {
  id: string;
  content: string;
  authorName: string;
  authorAvatar: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  engagementRate: number; // Percentage
  createdAt: string;
}

export interface TopPostsResponse {
  posts: TopPost[];
  period: AnalyticsPeriod;
  total: number;
}

export interface UserActivity {
  date: string;
  postsCreated: number;
  commentsCreated: number;
  likesGiven: number;
  activeMinutes: number;
}

export interface UserActivityResponse {
  activity: UserActivity[];
  period: AnalyticsPeriod;
  summary: {
    totalPosts: number;
    totalComments: number;
    totalLikes: number;
    avgActiveMinutes: number;
  };
}

export interface AnalyticsOverviewResponse {
  metrics: EngagementMetrics;
  period: AnalyticsPeriod;
  generatedAt: string;
}

export interface AnalyticsExportData {
  overview: AnalyticsOverviewResponse;
  timeSeries: EngagementTimeSeriesResponse;
  topPosts: TopPostsResponse;
  userActivity: UserActivityResponse;
  exportedAt: string;
  format: 'json' | 'csv';
}
