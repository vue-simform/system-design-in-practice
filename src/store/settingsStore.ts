/**
 * Settings Store
 * 
 * Manages application settings and preferences with persistence.
 * Allows users to enable/disable debug features and analytics.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// Settings Types
// ============================================================================

export interface SettingsState {
  // Debug Settings
  showScrollDebugger: boolean;
  showCacheMetrics: boolean;
  showPerformanceMetrics: boolean;
  showNetworkStatus: boolean;
  showPWAStatus: boolean;
  
  // Analytics Settings
  showAnalytics: boolean;
  enableAnalyticsTracking: boolean;
  
  // Developer Settings
  showDevTools: boolean;
  enableVerboseLogging: boolean;
  
  // Actions
  toggleScrollDebugger: () => void;
  toggleCacheMetrics: () => void;
  togglePerformanceMetrics: () => void;
  toggleNetworkStatus: () => void;
  togglePWAStatus: () => void;
  toggleAnalytics: () => void;
  toggleAnalyticsTracking: () => void;
  toggleDevTools: () => void;
  toggleVerboseLogging: () => void;
  resetSettings: () => void;
}

// ============================================================================
// Default Settings
// ============================================================================

const defaultSettings = {
  // Debug features - off by default in production
  showScrollDebugger: import.meta.env.DEV,
  showCacheMetrics: false,
  showPerformanceMetrics: false,
  showNetworkStatus: true,
  showPWAStatus: true,
  
  // Analytics - enabled by default
  showAnalytics: true,
  enableAnalyticsTracking: true,
  
  // Developer settings - dev only by default
  showDevTools: import.meta.env.DEV,
  enableVerboseLogging: import.meta.env.DEV,
};

// ============================================================================
// Settings Store with Persistence
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      // Toggle functions
      toggleScrollDebugger: () =>
        set((state) => ({ showScrollDebugger: !state.showScrollDebugger })),
      
      toggleCacheMetrics: () =>
        set((state) => ({ showCacheMetrics: !state.showCacheMetrics })),
      
      togglePerformanceMetrics: () =>
        set((state) => ({ showPerformanceMetrics: !state.showPerformanceMetrics })),
      
      toggleNetworkStatus: () =>
        set((state) => ({ showNetworkStatus: !state.showNetworkStatus })),
      
      togglePWAStatus: () =>
        set((state) => ({ showPWAStatus: !state.showPWAStatus })),
      
      toggleAnalytics: () =>
        set((state) => ({ showAnalytics: !state.showAnalytics })),
      
      toggleAnalyticsTracking: () =>
        set((state) => ({ enableAnalyticsTracking: !state.enableAnalyticsTracking })),
      
      toggleDevTools: () =>
        set((state) => ({ showDevTools: !state.showDevTools })),
      
      toggleVerboseLogging: () =>
        set((state) => ({ enableVerboseLogging: !state.enableVerboseLogging })),
      
      // Reset to defaults
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'newsfeed-settings',
      version: 1,
    }
  )
);

// ============================================================================
// Selectors (for optimized re-renders)
// ============================================================================

export const selectDebugSettings = (state: SettingsState) => ({
  showScrollDebugger: state.showScrollDebugger,
  showCacheMetrics: state.showCacheMetrics,
  showPerformanceMetrics: state.showPerformanceMetrics,
  showNetworkStatus: state.showNetworkStatus,
  showPWAStatus: state.showPWAStatus,
});

export const selectAnalyticsSettings = (state: SettingsState) => ({
  showAnalytics: state.showAnalytics,
  enableAnalyticsTracking: state.enableAnalyticsTracking,
});

export const selectDeveloperSettings = (state: SettingsState) => ({
  showDevTools: state.showDevTools,
  enableVerboseLogging: state.enableVerboseLogging,
});
