/**
 * Analytics Hooks
 * 
 * React Query hooks for fetching analytics data with caching and refetch strategies.
 * 
 * Features:
 * - 5-minute stale time for analytics data (data changes slowly)
 * - Automatic refetch on window focus
 * - Period parameter support (7d, 30d, 90d)
 * - Export functionality
 * 
 * System Design Concepts:
 * - Data Caching: Long stale time for analytics (5 minutes)
 * - Query Keys: Include period to cache different time ranges separately
 * - Error Handling: Graceful error states with retry logic
 */

import { useQuery } from '@tanstack/react-query';
import { feedApi } from '../services/api';
import type {
  AnalyticsOverviewResponse,
  EngagementTimeSeriesResponse,
  TopPostsResponse,
  UserActivityResponse,
  AnalyticsPeriod,
} from '../types';

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Fetch analytics overview metrics
 * 
 * Returns:
 * - Engagement metrics (likes, comments, shares, views)
 * - Change percentages compared to previous period
 * - Engagement rate, reach, impressions
 * 
 * @param period - Time period: '7d', '30d', or '90d'
 */
export function useAnalyticsOverview(period: AnalyticsPeriod = '7d') {
  return useQuery<AnalyticsOverviewResponse>({
    queryKey: ['analytics', 'overview', period],
    queryFn: () => feedApi.getAnalyticsOverview(period),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (renamed from cacheTime)
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

/**
 * Fetch engagement time series data
 * 
 * Returns:
 * - Daily engagement data (likes, comments, shares, views)
 * - Summary totals and averages
 * 
 * Used for:
 * - Line/area charts showing trends over time
 * - Identifying engagement patterns
 * 
 * @param period - Time period: '7d', '30d', or '90d'
 */
export function useEngagementTimeSeries(period: AnalyticsPeriod = '7d') {
  return useQuery<EngagementTimeSeriesResponse>({
    queryKey: ['analytics', 'engagement', period],
    queryFn: () => feedApi.getEngagementTimeSeries(period),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

/**
 * Fetch top performing posts
 * 
 * Returns:
 * - Posts sorted by engagement rate
 * - Content preview, author info
 * - Engagement metrics per post
 * 
 * Used for:
 * - Top posts table
 * - Identifying best-performing content
 * 
 * @param period - Time period: '7d', '30d', or '90d'
 * @param limit - Number of posts to return (default: 10)
 */
export function useTopPosts(period: AnalyticsPeriod = '7d', limit = 10) {
  return useQuery<TopPostsResponse>({
    queryKey: ['analytics', 'topPosts', period, limit],
    queryFn: () => feedApi.getTopPosts(period, limit),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

/**
 * Fetch user activity data
 * 
 * Returns:
 * - Daily activity metrics (posts created, comments, likes)
 * - Active time per day
 * - Summary totals and averages
 * 
 * Used for:
 * - Activity charts
 * - User engagement tracking
 * 
 * @param period - Time period: '7d', '30d', or '90d'
 */
export function useUserActivity(period: AnalyticsPeriod = '7d') {
  return useQuery<UserActivityResponse>({
    queryKey: ['analytics', 'activity', period],
    queryFn: () => feedApi.getUserActivity(period),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

/**
 * Export analytics data as JSON or CSV
 * 
 * This is not a hook - it's a utility function that triggers download
 * Call this function from an onClick handler
 * 
 * @param period - Time period: '7d', '30d', or '90d'
 * @param format - Export format: 'json' or 'csv'
 */
export async function exportAnalyticsData(
  period: AnalyticsPeriod = '7d',
  format: 'json' | 'csv' = 'json'
): Promise<void> {
  try {
    // Fetch all analytics data
    const [overview, engagement, topPosts, activity] = await Promise.all([
      feedApi.getAnalyticsOverview(period),
      feedApi.getEngagementTimeSeries(period),
      feedApi.getTopPosts(period, 20), // Export top 20 posts
      feedApi.getUserActivity(period),
    ]);

    const exportData = {
      overview,
      timeSeries: engagement,
      topPosts,
      userActivity: activity,
      exportedAt: new Date().toISOString(),
      format,
    };

    let blob: Blob;
    let filename: string;

    if (format === 'json') {
      // Export as JSON
      blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      filename = `analytics-${period}-${Date.now()}.json`;
    } else {
      // Export as CSV - convert to simple flat structure
      const csvRows = [
        // Header
        'Metric,Value,Change %,Period',
        // Overview metrics
        `Total Likes,${overview.metrics.totalLikes.value},${overview.metrics.totalLikes.change},${period}`,
        `Total Comments,${overview.metrics.totalComments.value},${overview.metrics.totalComments.change},${period}`,
        `Total Shares,${overview.metrics.totalShares.value},${overview.metrics.totalShares.change},${period}`,
        `Total Views,${overview.metrics.totalViews.value},${overview.metrics.totalViews.change},${period}`,
        `Engagement Rate,${overview.metrics.engagementRate.value}%,${overview.metrics.engagementRate.change},${period}`,
        `Reach,${overview.metrics.reach.value},${overview.metrics.reach.change},${period}`,
        `Impressions,${overview.metrics.impressions.value},${overview.metrics.impressions.change},${period}`,
        '',
        // Time series summary
        'Date,Likes,Comments,Shares,Views,Engagement',
        ...engagement.data.map((d: any) =>
          `${d.date},${d.likes},${d.comments},${d.shares},${d.views},${d.engagement}`
        ),
      ];

      blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      filename = `analytics-${period}-${Date.now()}.csv`;
    }

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error('Failed to export analytics data');
  }
}
