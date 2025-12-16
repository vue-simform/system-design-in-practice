/**
 * PWA Status Component
 * 
 * Displays PWA installation status, service worker state, and provides
 * install prompt for users. Useful for debugging and user guidance.
 * 
 * Features:
 * - Real-time service worker status
 * - Install prompt button
 * - Update notification
 * - Cache management
 * - PWA capabilities check
 */

import { useEffect, useState } from 'react';
import {
  getServiceWorkerStatus,
  isAppInstalled,
  showInstallPrompt,
  clearAllCaches,
} from '../../utils/serviceWorkerRegistration';

interface PWAStatusProps {
  showDebugInfo?: boolean;
}

export function PWAStatus({ showDebugInfo = false }: PWAStatusProps) {
  const [swStatus, setSwStatus] = useState({
    supported: false,
    registered: false,
    active: false,
    waiting: false,
    installing: false,
  });
  const [installed, setInstalled] = useState(false);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check initial status
    checkStatus();
    setInstalled(isAppInstalled());

    // Listen for install prompt
    const handleInstallPrompt = () => {
      setShowInstallButton(true);
    };
    window.addEventListener('sw-install-available', handleInstallPrompt);

    // Listen for updates
    const handleUpdate = () => {
      setUpdateAvailable(true);
    };
    window.addEventListener('sw-update-available', handleUpdate);

    // Refresh status periodically
    const interval = setInterval(checkStatus, 5000);

    return () => {
      window.removeEventListener('sw-install-available', handleInstallPrompt);
      window.removeEventListener('sw-update-available', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const checkStatus = async () => {
    const status = await getServiceWorkerStatus();
    setSwStatus(status);
  };

  const handleInstall = async () => {
    const accepted = await showInstallPrompt();
    if (accepted) {
      setShowInstallButton(false);
      setInstalled(true);
    }
  };

  const handleUpdate = () => {
    // Send skip waiting message to service worker
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  };

  const handleClearCache = async () => {
    await clearAllCaches();
    window.location.reload();
  };

  // Don't show anything if not in debug mode and everything is working
  if (!showDebugInfo && swStatus.active && !updateAvailable && !showInstallButton) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      {/* Update Available Notification */}
      {updateAvailable && (
        <div className="mb-2 bg-blue-600 text-white rounded-lg shadow-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold mb-1">Update Available</h4>
              <p className="text-sm text-blue-100">
                A new version is ready. Reload to update.
              </p>
            </div>
            <button
              onClick={() => setUpdateAvailable(false)}
              className="text-blue-100 hover:text-white ml-2"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          <button
            onClick={handleUpdate}
            className="mt-3 w-full bg-white text-blue-600 font-medium py-2 px-4 rounded hover:bg-blue-50 transition-colors"
          >
            Reload Now
          </button>
        </div>
      )}

      {/* Install Prompt */}
      {showInstallButton && !installed && (
        <div className="mb-2 bg-indigo-600 text-white rounded-lg shadow-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold mb-1">Install App</h4>
              <p className="text-sm text-indigo-100">
                Install for offline access and better performance.
              </p>
            </div>
            <button
              onClick={() => setShowInstallButton(false)}
              className="text-indigo-100 hover:text-white ml-2"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          <button
            onClick={handleInstall}
            className="mt-3 w-full bg-white text-indigo-600 font-medium py-2 px-4 rounded hover:bg-indigo-50 transition-colors"
          >
            Install Now
          </button>
        </div>
      )}

      {/* Debug Info */}
      {showDebugInfo && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm">
          <h4 className="font-semibold mb-3 text-gray-900">PWA Status</h4>
          
          <div className="space-y-2 mb-3">
            <StatusItem
              label="Service Worker Support"
              value={swStatus.supported}
            />
            <StatusItem
              label="Registered"
              value={swStatus.registered}
            />
            <StatusItem
              label="Active"
              value={swStatus.active}
            />
            <StatusItem
              label="Installing"
              value={swStatus.installing}
            />
            <StatusItem
              label="Update Waiting"
              value={swStatus.waiting}
            />
            <StatusItem
              label="Installed as PWA"
              value={installed}
            />
          </div>

          <div className="space-y-2">
            <button
              onClick={checkStatus}
              className="w-full bg-gray-100 text-gray-700 py-2 px-3 rounded hover:bg-gray-200 transition-colors text-xs font-medium"
            >
              Refresh Status
            </button>
            <button
              onClick={handleClearCache}
              className="w-full bg-red-100 text-red-700 py-2 px-3 rounded hover:bg-red-200 transition-colors text-xs font-medium"
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatusItemProps {
  label: string;
  value: boolean;
}

function StatusItem({ label, value }: StatusItemProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-600">{label}:</span>
      <span className={`font-medium ${value ? 'text-green-600' : 'text-gray-400'}`}>
        {value ? '✓ Yes' : '✗ No'}
      </span>
    </div>
  );
}

/**
 * PWA Install Button
 * 
 * Standalone button component for triggering PWA install
 */
export function PWAInstallButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isAppInstalled());

    const handleInstallPrompt = () => {
      setCanInstall(true);
    };
    window.addEventListener('sw-install-available', handleInstallPrompt);

    return () => {
      window.removeEventListener('sw-install-available', handleInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    const accepted = await showInstallPrompt();
    if (accepted) {
      setCanInstall(false);
      setInstalled(true);
    }
  };

  if (installed || !canInstall) {
    return null;
  }

  return (
    <button
      onClick={handleInstall}
      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
      aria-label="Install app"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Install App
    </button>
  );
}
