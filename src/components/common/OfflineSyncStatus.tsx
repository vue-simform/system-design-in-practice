/**
 * Offline Sync Status Component
 * 
 * Displays offline queue status and provides manual sync trigger.
 * Shows pending actions, sync progress, and errors.
 * 
 * Features:
 * - Real-time queue statistics
 * - Manual sync button
 * - Expandable action list
 * - Error details
 * - Auto-sync on reconnection
 */

import { useEffect, useState } from 'react';
import { useOfflineQueue, getAllActions, type QueuedAction } from '../../utils/offlineQueue';

const CURRENT_USER_ID = 'user-1'; // TODO: Replace with real auth

export function OfflineSyncStatus() {
  const { stats, isSyncing, syncNow } = useOfflineQueue();
  const [isExpanded, setIsExpanded] = useState(false);
  const [actions, setActions] = useState<QueuedAction[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Update online status
  useEffect(() => {
    const handleOnline = async () => {
      console.log('[OfflineSyncStatus] Coming back online, sync will be triggered by global handler');
      setIsOnline(true);
    };

    const handleOffline = () => {
      console.log('[OfflineSyncStatus] Going offline...');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load actions when expanded
  useEffect(() => {
    if (isExpanded) {
      const loadActions = async () => {
        const allActions = await getAllActions();
        setActions(allActions.sort((a, b) => b.timestamp - a.timestamp));
      };
      loadActions();
      
      // Refresh every 2 seconds when expanded
      const interval = setInterval(loadActions, 2000);
      return () => clearInterval(interval);
    }
  }, [isExpanded]);

  // Don't show if no pending/failed actions and online
  if (stats.total === 0 && isOnline) {
    return null;
  }

  const handleSync = async () => {
    await syncNow();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {/* Status Badge */}
      <div className="bg-white rounded-lg shadow-lg border-2 border-blue-500 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            {/* Status Indicator */}
            <div
              className={`w-3 h-3 rounded-full ${
                !isOnline
                  ? 'bg-red-500 animate-pulse'
                  : isSyncing
                  ? 'bg-yellow-500 animate-pulse'
                  : stats.pending > 0
                  ? 'bg-blue-500'
                  : 'bg-green-500'
              }`}
            />

            {/* Status Text */}
            <div className="text-left">
              <div className="font-semibold text-gray-900">
                {!isOnline
                  ? 'Offline Mode'
                  : isSyncing
                  ? 'Syncing...'
                  : stats.pending > 0
                  ? `${stats.pending} Pending`
                  : 'Synced'}
              </div>
              <div className="text-xs text-gray-500">
                {!isOnline
                  ? 'Changes will sync when online'
                  : stats.failed > 0
                  ? `${stats.failed} failed to sync`
                  : 'All changes saved'}
              </div>
            </div>
          </div>

          {/* Expand Icon */}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-200">
            {/* Statistics */}
            <div className="px-4 py-3 bg-gray-50 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-semibold text-gray-900">{stats.pending}</div>
                <div className="text-gray-500">Pending</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">{stats.completed}</div>
                <div className="text-gray-500">Synced</div>
              </div>
              <div>
                <div className="font-semibold text-red-600">{stats.failed}</div>
                <div className="text-gray-500">Failed</div>
              </div>
            </div>

            {/* Sync Button */}
            {isOnline && stats.pending > 0 && (
              <div className="px-4 py-2 border-t border-gray-200">
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {isSyncing ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Syncing...
                    </span>
                  ) : (
                    `Sync ${stats.pending} Action${stats.pending > 1 ? 's' : ''} Now`
                  )}
                </button>
              </div>
            )}

            {/* Action List */}
            {actions.length > 0 && (
              <div className="px-4 py-3 max-h-64 overflow-y-auto border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  Recent Actions
                </div>
                <div className="space-y-2">
                  {actions.slice(0, 10).map((action) => (
                    <div
                      key={action.id}
                      className={`flex items-start space-x-2 text-xs p-2 rounded ${
                        action.status === 'completed'
                          ? 'bg-green-50'
                          : action.status === 'failed'
                          ? 'bg-red-50'
                          : action.status === 'syncing'
                          ? 'bg-yellow-50'
                          : 'bg-gray-50'
                      }`}
                    >
                      {/* Status Icon */}
                      <div className="shrink-0 mt-0.5">
                        {action.status === 'completed' ? (
                          <svg
                            className="w-4 h-4 text-green-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : action.status === 'failed' ? (
                          <svg
                            className="w-4 h-4 text-red-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : action.status === 'syncing' ? (
                          <svg
                            className="w-4 h-4 text-yellow-600 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Action Details */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">
                          {action.type.replace(/_/g, ' ')}
                        </div>
                        <div className="text-gray-500 truncate">
                          {new Date(action.timestamp).toLocaleTimeString()}
                          {action.retries > 0 && ` • Retry ${action.retries}`}
                        </div>
                        {action.error && (
                          <div className="text-red-600 text-xs mt-1">
                            {action.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Info Message */}
            {!isOnline && (
              <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
                <div className="flex items-start space-x-2">
                  <svg
                    className="w-5 h-5 text-blue-600 shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-xs text-blue-900">
                    You're offline. Changes are saved locally and will sync automatically
                    when you're back online.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
