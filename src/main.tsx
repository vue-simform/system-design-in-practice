import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { queryClient } from './config/queryClient';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OfflineBanner, SlowNetworkWarning } from './hooks/useNetworkStatus';
import { registerServiceWorker } from './utils/serviceWorkerRegistration';
import { cleanupStaleData } from './utils/statePersistence';

/**
 * Application Entry Point
 * 
 * Sets up the React application with:
 * - Global Error Boundary for runtime error catching
 * - React Query for server state management
 * - React Router for navigation
 * - React Query DevTools for debugging
 * - Network status detection
 * - Service Worker for offline support (PWA)
 * - State persistence cleanup on startup
 */

// Clean up stale persisted state on app initialization
try {
  cleanupStaleData();
} catch (error) {
  // Silent error handling
}

// Register Service Worker for PWA functionality
// Enable in both dev and prod for testing, but service worker will be more robust in prod
registerServiceWorker().then(registration => {
  if (registration) {
    console.log('✅ Service Worker registered successfully');
  }
}).catch(error => {
  console.warn('⚠️ Service Worker registration failed:', error);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {/* Network Status Indicators */}
          <OfflineBanner />
          <SlowNetworkWarning />
          
          <App />
        </BrowserRouter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
