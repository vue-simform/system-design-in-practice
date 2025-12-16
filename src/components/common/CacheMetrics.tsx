/**
 * CacheMetrics Component
 * 
 * Displays real-time cache performance metrics across all cache layers.
 * Helps developers and power users understand cache effectiveness.
 * 
 * Features:
 * - Cache hit rate visualization
 * - Storage usage breakdown by layer
 * - Cache size and entry counts
 * - Clear cache controls
 * - Auto-refresh metrics
 * 
 * System Design Concepts:
 * - Real-time monitoring
 * - Multi-layer cache visibility
 * - Performance metrics tracking
 * - User-friendly data visualization
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  clearExpiredCache,
  getCacheStats,
} from '../../utils/indexedDBCache';
import { invalidateAllCaches } from '../../utils/cacheInvalidation';

interface CacheLayer {
  name: string;
  description: string;
  size: number;
  entries: number;
  hits: number;
  misses: number;
  hitRate: number;
}

export function CacheMetrics() {
  const queryClient = useQueryClient();
  
  const [indexedDBStats, setIndexedDBStats] = useState({
    totalSize: 0,
    hitCount: 0,
    missCount: 0,
  });
  const [isClearing, setIsClearing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch IndexedDB stats
  useEffect(() => {
    const fetchStats = async () => {
      const stats = await getCacheStats();
      setIndexedDBStats(stats);
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, []);

  // Calculate cache layers
  const layers: CacheLayer[] = [
    {
      name: 'L1: Memory (React Query)',
      description: 'Fast in-memory cache, cleared on page reload',
      size: 0, // React Query doesn't expose size easily
      entries: queryClient.getQueryCache().getAll().length,
      hits: 0, // Would need custom tracking
      misses: 0,
      hitRate: 0,
    },
    {
      name: 'L2: Persistent (IndexedDB)',
      description: 'Persistent browser storage, survives page reloads',
      size: indexedDBStats.totalSize,
      entries: 0, // Would need to count from stores
      hits: indexedDBStats.hitCount,
      misses: indexedDBStats.missCount,
      hitRate:
        indexedDBStats.hitCount + indexedDBStats.missCount > 0
          ? (indexedDBStats.hitCount /
              (indexedDBStats.hitCount + indexedDBStats.missCount)) *
            100
          : 0,
    },
    {
      name: 'L3: Network (Service Worker)',
      description: 'Static asset caching, offline support',
      size: 0, // Would need cache.keys() to count
      entries: 0,
      hits: 0, // Service Worker would need to track this
      misses: 0,
      hitRate: 0,
    },
  ];

  // Aggregate metrics
  const totalHits = layers.reduce((sum, layer) => sum + layer.hits, 0);
  const totalMisses = layers.reduce((sum, layer) => sum + layer.misses, 0);
  const totalRequests = totalHits + totalMisses;
  const overallHitRate =
    totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

  // Handle clear all caches
  const handleClearAll = async () => {
    if (
      !window.confirm(
        'Are you sure you want to clear all caches? This will remove all cached data and the app will need to refetch everything from the network.'
      )
    ) {
      return;
    }

    setIsClearing(true);
    try {
      await invalidateAllCaches(queryClient);
      alert('All caches cleared successfully!');
      
      // Reload to re-fetch data
      window.location.reload();
    } catch (error) {
      alert('Failed to clear caches. See console for details.');
    } finally {
      setIsClearing(false);
    }
  };

  // Handle clear expired only
  const handleClearExpired = async () => {
    setIsClearing(true);
    try {
      const deletedCount = await clearExpiredCache();
      alert(`Cleared ${deletedCount} expired cache entries!`);
    } catch (error) {
      alert('Failed to clear expired caches. See console for details.');
    } finally {
      setIsClearing(false);
    }
  };

  // Format bytes to human-readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="cache-metrics bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cache Metrics</h2>
          <p className="text-sm text-gray-600 mt-1">
            Multi-layer cache performance dashboard
          </p>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Overall Hit Rate */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              Overall Hit Rate
            </p>
            <p className="text-4xl font-bold text-gray-900">
              {overallHitRate.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {totalHits} hits / {totalRequests} requests
            </p>
          </div>
          <div className="w-32 h-32">
            {/* Circular progress indicator */}
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="8"
                strokeDasharray={`${overallHitRate * 2.51} 251`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Cache Layers */}
      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Cache Layers</h3>
        {layers.map((layer, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{layer.name}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {layer.description}
                </p>
                
                {showDetails && (
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-gray-600">Size:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {formatBytes(layer.size)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Entries:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {layer.entries}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Hits:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {layer.hits}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Misses:</span>
                      <span className="ml-2 font-medium text-red-600">
                        {layer.misses}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="ml-4 text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {layer.hitRate.toFixed(0)}%
                </div>
                <div className="text-xs text-gray-600 mt-1">hit rate</div>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${layer.hitRate}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Cache Management
        </h3>
        <div className="flex gap-3">
          <button
            onClick={handleClearExpired}
            disabled={isClearing}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isClearing ? 'Clearing...' : 'Clear Expired'}
          </button>
          <button
            onClick={handleClearAll}
            disabled={isClearing}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isClearing ? 'Clearing...' : 'Clear All Caches'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          Clearing caches will force the app to refetch all data from the network
        </p>
      </div>

      {/* Info Footer */}
      {showDetails && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-2">
            How Cache Layers Work
          </h4>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>
              <strong>L1 (Memory):</strong> Fastest, cleared on page reload.
              Managed by React Query.
            </li>
            <li>
              <strong>L2 (IndexedDB):</strong> Persistent across reloads, 7-day
              TTL. Provides offline support.
            </li>
            <li>
              <strong>L3 (Service Worker):</strong> Caches static assets for
              instant loading and offline access.
            </li>
          </ul>
          <p className="text-sm text-gray-600 mt-3">
            Cache strategy: L1 → L2 → L3 → Network. Each layer falls back to the
            next if data not found.
          </p>
        </div>
      )}
    </div>
  );
}
