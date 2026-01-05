/**
 * Service Worker Registration
 * 
 * Registers the service worker for PWA functionality.
 * Handles installation, updates, and provides utility functions.
 * 
 * Features:
 * - Automatic service worker registration
 * - Update detection and notification
 * - Cache management utilities
 * - PWA install prompt handling
 */

// Check if service workers are supported
const isServiceWorkerSupported = 'serviceWorker' in navigator;

/**
 * Register Service Worker
 * 
 * Call this from main.tsx on app initialization
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported) {
    return null;
  }

  try {
    // Check if already registered to prevent duplicate registrations
    const existingRegistration = await navigator.serviceWorker.getRegistration('/');
    
    if (existingRegistration) {
      console.log('[SW Registration] Service Worker already registered');
      return existingRegistration;
    }
    
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      // Prevent service worker from updating too aggressively during development
      updateViaCache: 'none',
    });

    console.log('[SW Registration] Service Worker registered successfully');

    // Handle service worker updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      console.log('[SW Registration] Update found, installing new worker');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker installed while old one is controlling the page
          console.log('[SW Registration] New service worker installed');
          
          // Show update notification
          showUpdateNotification(newWorker);
        }

        if (newWorker.state === 'activated') {
          console.log('[SW Registration] Service worker activated');
        }
      });
    });

    // Check for updates periodically (every hour) - only in production
    if (import.meta.env.PROD) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }

    return registration;
  } catch (error) {
    console.error('[SW Registration] Failed to register:', error);
    return null;
  }
}

/**
 * Unregister Service Worker
 * 
 * Remove service worker and clear caches
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (registration) {
      const unregistered = await registration.unregister();
      return unregistered;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Clear all caches
 * 
 * Removes all cached data from service worker caches
 */
export async function clearAllCaches(): Promise<void> {
  if (!('caches' in window)) {
    return;
  }

  try {
    const cacheNames = await caches.keys();
    
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );


    // Send message to service worker to clear its caches too
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.active) {
      registration.active.postMessage({ type: 'CLEAR_CACHE' });
    }
  } catch (error) {
  }
}

/**
 * Prefetch URLs for caching
 * 
 * Tells service worker to cache specific URLs in advance
 */
export async function prefetchUrls(urls: string[]): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  
  if (registration?.active) {
    registration.active.postMessage({
      type: 'CACHE_URLS',
      urls,
    });
  }
}

/**
 * Show update notification
 * 
 * Notify user that a new version is available
 */
function showUpdateNotification(newWorker: ServiceWorker): void {
  // Check if we should show notification (can be integrated with your toast system)
  const shouldNotify = true; // Configure based on your preferences

  if (shouldNotify) {
    
    // Create a custom event that can be caught by your UI
    const event = new CustomEvent('sw-update-available', {
      detail: { worker: newWorker },
    });
    window.dispatchEvent(event);

    // You can integrate with your toast notification system here
    // Example:
    // import { useToastStore } from './store/toastStore';
    // const toast = useToastStore.getState();
    // toast.info('Update Available', 'A new version is available. Reload to update.', {
    //   action: () => {
    //     newWorker.postMessage({ type: 'SKIP_WAITING' });
    //     window.location.reload();
    //   },
    //   actionLabel: 'Reload',
    // });
  }
}

/**
 * Handle PWA install prompt
 * 
 * Capture and control the "Add to Home Screen" prompt
 */
let deferredPrompt: any = null;

// Listen for install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Dispatch custom event that UI can listen to
  const event = new CustomEvent('sw-install-available');
  window.dispatchEvent(event);
});

/**
 * Show install prompt
 * 
 * Trigger the "Add to Home Screen" prompt
 */
export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) {
    return false;
  }

  // Show the install prompt
  deferredPrompt.prompt();

  // Wait for the user to respond to the prompt
  const { outcome } = await deferredPrompt.userChoice;

  // Clear the deferred prompt
  deferredPrompt = null;

  return outcome === 'accepted';
}

/**
 * Check if app is installed
 */
export function isAppInstalled(): boolean {
  // Check if running as PWA
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Get service worker status
 */
export async function getServiceWorkerStatus(): Promise<{
  supported: boolean;
  registered: boolean;
  active: boolean;
  waiting: boolean;
  installing: boolean;
}> {
  const status = {
    supported: isServiceWorkerSupported,
    registered: false,
    active: false,
    waiting: false,
    installing: false,
  };

  if (!isServiceWorkerSupported) {
    return status;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (registration) {
      status.registered = true;
      status.active = !!registration.active;
      status.waiting = !!registration.waiting;
      status.installing = !!registration.installing;
    }
  } catch (error) {
  }

  return status;
}

// Listen for when the service worker takes control
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  // Reload the page when service worker takes control
  // This ensures the page is using the latest service worker
  window.location.reload();
});

// Export status check
export { isServiceWorkerSupported };
