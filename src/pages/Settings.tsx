/**
 * Settings Page
 * 
 * Allows users to configure application settings including:
 * - Debug components (ScrollDebugger, CacheMetrics, etc.)
 * - Analytics and tracking
 * - Developer tools
 * - Cache and storage management
 */

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '../store/settingsStore';
import { clearAllStorage, getStorageStats, registerReactQueryClearFn } from '../utils/cacheManagement';
import { useToast } from '../hooks/useToast';

export function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const {
    // Debug Settings
    showScrollDebugger,
    showCacheMetrics,
    showPerformanceMetrics,
    showNetworkStatus,
    showPWAStatus,
    toggleScrollDebugger,
    toggleCacheMetrics,
    togglePerformanceMetrics,
    toggleNetworkStatus,
    togglePWAStatus,
    
    // Analytics Settings
    showAnalytics,
    enableAnalyticsTracking,
    toggleAnalytics,
    toggleAnalyticsTracking,
    
    // Developer Settings
    showDevTools,
    enableVerboseLogging,
    toggleDevTools,
    toggleVerboseLogging,
    
    // Reset
    resetSettings,
  } = useSettingsStore();

  // Storage stats
  const [storageStats, setStorageStats] = useState({
    quota: 0,
    usage: 0,
    percentage: 0,
    available: 0,
  });
  const [isClearing, setIsClearing] = useState(false);

  // Register React Query cache clear function
  useEffect(() => {
    registerReactQueryClearFn(() => {
      queryClient.clear();
    });
  }, [queryClient]);

  // Load storage stats on mount
  useEffect(() => {
    loadStorageStats();
  }, []);

  const loadStorageStats = async () => {
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  };

  const handleClearAllCache = async () => {
    const confirmed = window.confirm(
      '⚠️ This will clear ALL cached data including:\n\n' +
      '• Service Worker caches\n' +
      '• IndexedDB databases\n' +
      '• LocalStorage (including settings!)\n' +
      '• SessionStorage\n' +
      '• Cookies\n' +
      '• React Query cache\n\n' +
      'The page will reload after clearing. Continue?'
    );

    if (!confirmed) return;

    setIsClearing(true);

    try {
      const result = await clearAllStorage();
      
      if (result.success) {
        toast.success('All caches cleared successfully!');
        // Wait a bit for toast to show, then reload
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.error(`Cleared with errors: ${result.errors.join(', ')}`);
        setIsClearing(false);
      }
    } catch (error) {
      toast.error('Failed to clear caches');
      console.error('Cache clear error:', error);
      setIsClearing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">
          Configure application settings, debug tools, and analytics preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Debug Settings Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Debug Components
            </h2>
            <p className="text-sm text-gray-600">
              Enable debugging components to monitor application behavior and performance.
            </p>
          </div>

          <div className="space-y-4">
            <SettingToggle
              label="Scroll Position Debugger"
              description="Shows scroll position and restoration state in the feed"
              enabled={showScrollDebugger}
              onToggle={toggleScrollDebugger}
            />

            <SettingToggle
              label="Cache Metrics"
              description="Display cache hit/miss rates and storage statistics"
              enabled={showCacheMetrics}
              onToggle={toggleCacheMetrics}
            />

            <SettingToggle
              label="Performance Metrics"
              description="Show performance metrics like render times and memory usage"
              enabled={showPerformanceMetrics}
              onToggle={togglePerformanceMetrics}
            />

            <SettingToggle
              label="Network Status Indicators"
              description="Display offline banner and slow network warnings"
              enabled={showNetworkStatus}
              onToggle={toggleNetworkStatus}
            />

            <SettingToggle
              label="PWA Status & Install Prompt"
              description="Show PWA installation status and service worker information"
              enabled={showPWAStatus}
              onToggle={togglePWAStatus}
            />
          </div>
        </section>

        {/* Analytics Settings Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Analytics & Tracking
            </h2>
            <p className="text-sm text-gray-600">
              Control analytics dashboard visibility and event tracking.
            </p>
          </div>

          <div className="space-y-4">
            <SettingToggle
              label="Show Analytics Dashboard"
              description="Display the analytics dashboard with user behavior insights"
              enabled={showAnalytics}
              onToggle={toggleAnalytics}
            />

            <SettingToggle
              label="Enable Analytics Tracking"
              description="Track user events and interactions for analytics (respects privacy)"
              enabled={enableAnalyticsTracking}
              onToggle={toggleAnalyticsTracking}
            />
          </div>
        </section>

        {/* Developer Settings Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Developer Tools
            </h2>
            <p className="text-sm text-gray-600">
              Advanced settings for development and debugging.
            </p>
          </div>

          <div className="space-y-4">
            <SettingToggle
              label="Show React Query DevTools"
              description="Display React Query DevTools panel for inspecting cache and queries"
              enabled={showDevTools}
              onToggle={toggleDevTools}
            />

            <SettingToggle
              label="Enable Verbose Logging"
              description="Log detailed information to browser console (may impact performance)"
              enabled={enableVerboseLogging}
              onToggle={toggleVerboseLogging}
            />
          </div>
        </section>

        {/* Storage Management Section */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Storage & Cache Management
            </h2>
            <p className="text-sm text-gray-600">
              Manage application storage and clear all cached data for a fresh start.
            </p>
          </div>

          {/* Storage Stats */}
          <div className="bg-linear-to-br from-blue-50 to-indigo-50 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-gray-900 mb-3">Storage Usage</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-blue-600">{storageStats.usage} MB</div>
                <div className="text-xs text-gray-600">Used</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{storageStats.available} MB</div>
                <div className="text-xs text-gray-600">Available</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{storageStats.quota} MB</div>
                <div className="text-xs text-gray-600">Total Quota</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{storageStats.percentage}%</div>
                <div className="text-xs text-gray-600">Usage</div>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-linear-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(storageStats.percentage, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Cache Types Info */}
          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
            <h3 className="font-medium text-gray-900 mb-3">Cached Data Types</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span className="text-gray-700">Service Worker</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-gray-700">IndexedDB</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span className="text-gray-700">LocalStorage</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span className="text-gray-700">SessionStorage</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                <span className="text-gray-700">Cookies</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
                <span className="text-gray-700">React Query</span>
              </div>
            </div>
          </div>

          {/* Clear Cache Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">Clear All Caches & Storage</h3>
              <p className="text-sm text-gray-600 mt-1">
                Remove ALL cached data, settings, and storage. The page will reload automatically.
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-red-600">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Warning: This action cannot be undone</span>
              </div>
            </div>
            <button
              onClick={handleClearAllCache}
              disabled={isClearing}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                isClearing
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white hover:shadow-md active:scale-95'
              }`}
            >
              {isClearing ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Clearing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Everything
                </>
              )}
            </button>
          </div>
        </section>

        {/* Actions */}
        <div className="flex justify-between items-center bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div>
            <h3 className="font-medium text-gray-900">Reset Settings Only</h3>
            <p className="text-sm text-gray-600">
              Restore default settings without clearing cached data
            </p>
          </div>
          <button
            onClick={resetSettings}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Reset to Defaults
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-600 mt-0.5 mr-3 shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h4 className="font-medium text-blue-900 mb-1">About Settings</h4>
              <p className="text-sm text-blue-800">
                Settings are saved to your browser's local storage and will persist across sessions.
                Debug components may impact performance and should be disabled in production environments.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Setting Toggle Component
// ============================================================================

interface SettingToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function SettingToggle({ label, description, enabled, onToggle }: SettingToggleProps) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 mr-4">
        <label htmlFor={label} className="font-medium text-gray-900 cursor-pointer">
          {label}
        </label>
        <p className="text-sm text-gray-600 mt-0.5">{description}</p>
      </div>
      
      <button
        id={label}
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        className={`
          relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent 
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${enabled ? 'bg-blue-600' : 'bg-gray-200'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
            transition duration-200 ease-in-out
            ${enabled ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  );
}
