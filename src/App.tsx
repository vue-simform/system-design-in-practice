/**
 * Main App Component
 * 
 * Root component with sidebar navigation and main content area
 * 
 * System Design: Route-based code splitting with lazy loading
 * Accessibility: WCAG 2.1 AA compliant with keyboard navigation, ARIA labels, and focus management
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { FeedContainer } from './components/feed/FeedContainer';
import { Sidebar } from './components/common/Sidebar';
import { ToastContainer } from './components/common/Toast';
import { useToastStore } from './hooks/useToast';
import { LoadingSkeleton } from './components/common/LoadingSkeleton';
import { SkipLink } from './utils/accessibility';
import { FeedErrorBoundary, ErrorBoundary } from './components/common/ErrorBoundary';
import { OfflineSyncStatus } from './components/common/OfflineSyncStatus';
import { PWAStatus } from './components/common/PWAStatus';
import { useSettingsStore } from './store/settingsStore';

// Lazy load Profile, Analytics, Developer Docs, Interview Prep, and Settings pages for code splitting
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const Analytics = lazy(() => import('./components/analytics/AnalyticsDashboard').then(module => ({ default: module.AnalyticsDashboard })));
const DeveloperDocs = lazy(() => import('./pages/DeveloperDocs').then(module => ({ default: module.DeveloperDocs })));
const InterviewPrep = lazy(() => import('./pages/InterviewPrep').then(module => ({ default: module.InterviewPrep })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));

function App() {
  const { toasts, removeToast } = useToastStore();
  const location = useLocation();
  const showPWAStatus = useSettingsStore((state) => state.showPWAStatus);
  const showNetworkStatus = useSettingsStore((state) => state.showNetworkStatus);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Skip to main content link for keyboard users */}
      <SkipLink href="#main-content">Skip to main content</SkipLink>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      
      {/* Offline Sync Status (controlled by settings) */}
      {showNetworkStatus && <OfflineSyncStatus />}
      
      {/* PWA Status - Shows install prompt and update notifications (controlled by settings) */}
      {showPWAStatus && <PWAStatus showDebugInfo={import.meta.env.DEV} />}
      
      {/* Left Sidebar with Feature List (Fixed Position) */}
      <Sidebar />

      {/* Main Content Area - with left margin to account for fixed sidebar */}
      <div className="flex-1 flex flex-col min-w-0 ml-80">
        {/* Header */}
        <header 
          className="bg-white border-b border-gray-200 sticky top-0 z-20"
          role="banner"
        >
          <div className="px-6">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center space-x-3">
                <div className="w-7 h-7 bg-linear-to-br from-blue-600 to-purple-600 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">N</span>
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900">NewsFeed</h1>
                  <p className="text-xs text-gray-500">System Design POC</p>
                </div>
              </div>
              <nav 
                className="flex items-center gap-1"
                role="navigation"
                aria-label="Main navigation"
              >
                <Link 
                  to="/" 
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    location.pathname === '/' 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  aria-label="Go to feed"
                  aria-current={location.pathname === '/' ? 'page' : undefined}
                >
                  Feed
                </Link>
                <Link 
                  to="/docs" 
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    location.pathname === '/docs' 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  aria-label="View developer documentation"
                  aria-current={location.pathname === '/docs' ? 'page' : undefined}
                >
                  Docs
                </Link>
                <Link 
                  to="/interview-prep" 
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    location.pathname === '/interview-prep' 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  aria-label="System design interview preparation"
                  aria-current={location.pathname === '/interview-prep' ? 'page' : undefined}
                >
                  Q&A
                </Link>
                <Link 
                  to="/analytics" 
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    location.pathname === '/analytics' 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  aria-label="View analytics dashboard"
                  aria-current={location.pathname === '/analytics' ? 'page' : undefined}
                >
                  Analytics
                </Link>
                <Link 
                  to="/settings" 
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    location.pathname === '/settings' 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  aria-label="Application settings"
                  aria-current={location.pathname === '/settings' ? 'page' : undefined}
                >
                  Settings
                </Link>
                {/* <Link 
                  to="/profile/1" 
                  className={`px-3 py-1.5 text-sm rounded transition-colors ${
                    location.pathname.startsWith('/profile') 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                  aria-label="View profile"
                  aria-current={location.pathname.startsWith('/profile') ? 'page' : undefined}
                >
                  Profile
                </Link> */}
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main 
          id="main-content"
          className="flex-1"
          role="main"
          aria-label="Main content"
        >
          <div className="container mx-auto px-6 py-8 max-w-4xl">
            <ErrorBoundary
              fallback={(error, reset) => (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Page</h2>
                  <p className="text-gray-600 mb-4">
                    {error.message || 'An error occurred while loading this page'}
                  </p>
                  <button
                    onClick={reset}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            >
              <Suspense fallback={
                <div className="space-y-4">
                  <LoadingSkeleton count={6} />
                </div>
              }>
                <Routes>
                  <Route path="/" element={
                    <FeedErrorBoundary>
                      <FeedContainer />
                    </FeedErrorBoundary>
                  } />
                  <Route path="/setup" element={<Home />} />
                  <Route path="/profile/:userId" element={<Profile />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/docs" element={<DeveloperDocs />} />
                  <Route path="/interview-prep" element={<InterviewPrep />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Home Page Component
 * 
 * Landing page showing setup status and next steps
 */
function Home() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          News Feed POC
        </h1>
        <p className="text-lg text-gray-600">
          Production-ready news feed with infinite scroll, real-time updates, and optimistic UI
        </p>
      </div>

      {/* Setup Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
            <span className="text-green-600 text-xl">✓</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Setup Complete
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-medium text-gray-900 mb-2">Core Dependencies</h3>
            <ul className="text-gray-700 space-y-1 text-sm">
              <li>• React 19 + TypeScript</li>
              <li>• Vite (Fast build tool)</li>
              <li>• React Query (Server state)</li>
              <li>• Zustand (Client state)</li>
              <li>• Tailwind CSS (Styling)</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-medium text-gray-900 mb-2">Features Ready</h3>
            <ul className="text-gray-700 space-y-1 text-sm">
              <li>• API service layer</li>
              <li>• TypeScript types</li>
              <li>• Query client config</li>
              <li>• Environment variables</li>
              <li>• Mock backend server</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          Configuration
        </h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium text-blue-900">API Base URL:</span>
            <code className="ml-2 bg-blue-100 px-2 py-1 rounded text-blue-800">
              {import.meta.env.VITE_API_BASE_URL || 'https://system-design-practical-production.up.railway.app/api'}
            </code>
          </div>
          <div>
            <span className="font-medium text-blue-900">Environment:</span>
            <code className="ml-2 bg-blue-100 px-2 py-1 rounded text-blue-800">
              {import.meta.env.MODE}
            </code>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-linear-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-purple-900 mb-3">
          Ready to Build
        </h3>
        <p className="text-purple-800 mb-4">
          All dependencies installed and configured. You can now start implementing features!
        </p>
        <div className="bg-white rounded p-4">
          <p className="text-sm text-gray-700 mb-2 font-medium">Start the backend server:</p>
          <code className="block bg-gray-100 px-3 py-2 rounded text-sm text-gray-800">
            cd server && npm start
          </code>
          <p className="text-xs text-gray-500 mt-2">
            Server running at https://system-design-practical-production.up.railway.app
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
