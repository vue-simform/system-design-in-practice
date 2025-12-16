/**
 * Analytics Dashboard
 * 
 * Comprehensive analytics page showing engagement metrics, trends, and top posts.
 * 
 * Features:
 * - Overview metrics with trend indicators
 * - Engagement time-series chart
 * - Top performing posts table
 * - Period selector (7d, 30d, 90d)
 * - Export functionality (JSON/CSV)
 * 
 * System Design:
 * - Lazy loading with React.lazy
 * - 5-minute data caching via React Query
 * - Responsive grid layout
 * - Client-side data export
 * - Recharts for visualizations
 */

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  useAnalyticsOverview,
  useEngagementTimeSeries,
  useTopPosts,
  exportAnalyticsData,
} from '../../hooks/useAnalytics';
import { useUIStore } from '../../store/uiStore';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import type { AnalyticsPeriod } from '../../types';

export function AnalyticsDashboard() {
  const selectedPeriod = useUIStore((state) => state.selectedAnalyticsPeriod);
  const setAnalyticsPeriod = useUIStore((state) => state.setAnalyticsPeriod);
  const [isExporting, setIsExporting] = useState(false);

  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(selectedPeriod);
  const { data: engagement, isLoading: engagementLoading } = useEngagementTimeSeries(selectedPeriod);
  const { data: topPosts, isLoading: topPostsLoading } = useTopPosts(selectedPeriod, 10);

  const handlePeriodChange = (period: AnalyticsPeriod) => {
    setAnalyticsPeriod(period);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      await exportAnalyticsData(selectedPeriod, format);
    } catch (error) {
      alert('Failed to export analytics data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-2">Track your engagement metrics and performance</p>
      </div>

      {/* Period Selector and Export */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodChange(period)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last {period === '7d' ? '7' : period === '30d' ? '30' : '90'} days
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleExport('json')}
            disabled={isExporting}
            className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Export JSON'}
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {overviewLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <LoadingSkeleton key={i} count={1} />
          ))
        ) : (
          overview && (
            <>
              <MetricCard
                title="Total Likes"
                value={overview.metrics.totalLikes.value}
                change={overview.metrics.totalLikes.change}
                changeDirection={overview.metrics.totalLikes.changeDirection}
                icon="❤️"
              />
              <MetricCard
                title="Total Comments"
                value={overview.metrics.totalComments.value}
                change={overview.metrics.totalComments.change}
                changeDirection={overview.metrics.totalComments.changeDirection}
              />
              <MetricCard
                title="Total Shares"
                value={overview.metrics.totalShares.value}
                change={overview.metrics.totalShares.change}
                changeDirection={overview.metrics.totalShares.changeDirection}
              />
              <MetricCard
                title="Engagement Rate"
                value={`${overview.metrics.engagementRate.value.toFixed(1)}%`}
                change={overview.metrics.engagementRate.change}
                changeDirection={overview.metrics.engagementRate.changeDirection}
              />
            </>
          )
        )}
      </div>

      {/* Engagement Chart */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Engagement Over Time</h2>
        {engagementLoading ? (
          <LoadingSkeleton count={3} />
        ) : engagement && engagement.data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={engagement.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="likes" stroke="#ef4444" strokeWidth={2} name="Likes" />
              <Line type="monotone" dataKey="comments" stroke="#3b82f6" strokeWidth={2} name="Comments" />
              <Line type="monotone" dataKey="shares" stroke="#10b981" strokeWidth={2} name="Shares" />
              <Line type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={2} name="Views" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">No engagement data available</p>
        )}
      </div>

      {/* Top Posts Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performing Posts</h2>
        {topPostsLoading ? (
          <LoadingSkeleton count={5} />
        ) : topPosts && topPosts.posts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Content</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Likes</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comments</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Shares</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topPosts.posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">{post.content}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{post.authorName}</td>
                    <td className="px-4 py-3 text-sm text-center">{post.likes}</td>
                    <td className="px-4 py-3 text-sm text-center">{post.comments}</td>
                    <td className="px-4 py-3 text-sm text-center">{post.shares}</td>
                    <td className="px-4 py-3 text-sm text-center font-medium text-blue-600">
                      {post.engagementRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No posts data available</p>
        )}
      </div>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  changeDirection: 'up' | 'down' | 'neutral';
  icon?: string;
}

function MetricCard({ title, value, change, changeDirection }: MetricCardProps) {
  const changeColor =
    changeDirection === 'up'
      ? 'text-green-600'
      : changeDirection === 'down'
      ? 'text-red-600'
      : 'text-gray-600';

  const changeIcon = changeDirection === 'up' ? '↑' : changeDirection === 'down' ? '↓' : '→';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-2">{value}</div>
      <div className={`text-sm font-medium ${changeColor}`}>
        {changeIcon} {Math.abs(change).toFixed(1)}% vs previous period
      </div>
    </div>
  );
}
