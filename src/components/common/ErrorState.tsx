/**
 * ErrorState Component
 * 
 * Displays user-friendly error messages with retry functionality.
 * Provides context about what went wrong and how to fix it.
 * 
 * Props:
 * - error: Error object or string message
 * - onRetry: Optional callback to retry the failed operation
 * 
 * Usage:
 * ```tsx
 * <ErrorState 
 *   error={error} 
 *   onRetry={() => refetch()} 
 * />
 * ```
 */

interface ErrorStateProps {
  error: Error | string;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8">
      <div className="flex flex-col items-center text-center">
        {/* Error Icon */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Error Message */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Oops! Something went wrong
        </h3>
        <p className="text-gray-600 mb-6 max-w-md">
          {errorMessage || 'We encountered an error while loading the feed.'}
        </p>

        {/* Retry Button */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        )}

        {/* Help Text */}
        <p className="text-sm text-gray-500 mt-4">
          If the problem persists, please check your internet connection or try again later.
        </p>
      </div>
    </div>
  );
}
