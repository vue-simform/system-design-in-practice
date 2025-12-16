/**
 * Network Status Hook
 * Detects online/offline status and network quality
 */

import { useState, useEffect } from 'react';
import { useToastStore } from '../store/toastStore';

// ============================================================================
// Online/Offline Detection
// ============================================================================

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const { info, warning } = useToastStore();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      info('Back Online', 'Your connection has been restored');
    };

    const handleOffline = () => {
      setIsOnline(false);
      warning('No Internet Connection', 'Please check your network connection');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [info, warning]);

  return isOnline;
}

// ============================================================================
// Network Quality Detection
// ============================================================================

export type NetworkQuality = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

interface NetworkInfo {
  effectiveType?: NetworkQuality;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export function useNetworkQuality(): NetworkInfo {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({});

  useEffect(() => {
    const connection = (navigator as any).connection || 
                       (navigator as any).mozConnection || 
                       (navigator as any).webkitConnection;

    if (!connection) {
      return;
    }

    const updateNetworkInfo = () => {
      setNetworkInfo({
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      });
    };

    updateNetworkInfo();
    connection.addEventListener('change', updateNetworkInfo);

    return () => {
      connection.removeEventListener('change', updateNetworkInfo);
    };
  }, []);

  return networkInfo;
}

// ============================================================================
// Offline Banner Component
// ============================================================================

export function OfflineBanner(): React.ReactElement | null {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white px-4 py-3 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center justify-center gap-2">
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
          />
        </svg>
        <span className="font-medium">
          No internet connection. Some features may not be available.
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Slow Network Warning Component
// ============================================================================

export function SlowNetworkWarning(): React.ReactElement | null {
  const { effectiveType } = useNetworkQuality();
  const [dismissed, setDismissed] = useState(false);

  // Show warning for slow networks
  if (dismissed || !effectiveType || effectiveType === '4g' || effectiveType === 'unknown') {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-40 bg-orange-100 border border-orange-300 rounded-lg p-4 max-w-sm shadow-lg"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-orange-600 shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          <h3 className="font-medium text-orange-900 text-sm mb-1">
            Slow Network Detected
          </h3>
          <p className="text-orange-800 text-xs">
            Some images and videos may load slowly on your {effectiveType} connection.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-orange-600 hover:text-orange-800"
          aria-label="Dismiss warning"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
