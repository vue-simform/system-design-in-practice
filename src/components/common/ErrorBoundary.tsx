/**
 * Error Boundary Components
 * React error boundaries for catching and handling runtime errors
 */

import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { classifyError, logError, type AppError } from '../../utils/errorHandling';
import { ErrorState, NetworkError, ServerError } from './ErrorStates';

// ============================================================================
// Error Boundary Props & State
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: AppError, reset: () => void) => ReactNode;
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  resetKeys?: any[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
}

// ============================================================================
// Global Error Boundary
// ============================================================================

/**
 * Top-level error boundary for the entire application
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError = classifyError(error);
    return {
      hasError: true,
      error: appError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const appError = classifyError(error);
    
    // Log error with React component stack
    logError(appError, {
      componentStack: errorInfo.componentStack,
      errorBoundary: 'GlobalErrorBoundary',
    });

    // Call optional error callback
    this.props.onError?.(appError, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error boundary when reset keys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      
      if (hasChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      // Default fallback UI
      return <GlobalErrorFallback error={this.state.error} onReset={this.reset} />;
    }

    return this.props.children;
  }
}

// ============================================================================
// Feed Error Boundary
// ============================================================================

/**
 * Specialized error boundary for feed components
 */
export class FeedErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError = classifyError(error);
    return {
      hasError: true,
      error: appError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const appError = classifyError(error);
    
    logError(appError, {
      componentStack: errorInfo.componentStack,
      errorBoundary: 'FeedErrorBoundary',
      component: 'Feed',
    });

    this.props.onError?.(appError, errorInfo);
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return <FeedErrorFallback error={this.state.error} onReset={this.reset} />;
    }

    return this.props.children;
  }
}

// ============================================================================
// Global Error Fallback UI
// ============================================================================

interface ErrorFallbackProps {
  error: AppError;
  onReset: () => void;
}

function GlobalErrorFallback({ error, onReset }: ErrorFallbackProps): React.ReactElement {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2">
          <ErrorState
            error={error}
            title="Application Error"
            onRetry={onReset}
            showDetails={import.meta.env.DEV}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Feed Error Fallback UI
// ============================================================================

function FeedErrorFallback({ error, onReset }: ErrorFallbackProps): React.ReactElement {
  // Use specific error components for better UX
  if (error.type === 'NETWORK') {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <NetworkError onRetry={onReset} />
      </div>
    );
  }

  if (error.type === 'SERVER') {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <ServerError onRetry={onReset} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] px-4">
      <ErrorState
        error={error}
        title="Unable to Load Feed"
        onRetry={onReset}
      />
    </div>
  );
}

// ============================================================================
// Hook for Programmatic Error Handling
// ============================================================================

/**
 * Hook to manually trigger error boundary
 */
export function useErrorHandler(): (error: Error) => void {
  const [, setError] = React.useState<Error | null>(null);

  return React.useCallback((error: Error) => {
    setError(() => {
      throw error;
    });
  }, []);
}

// ============================================================================
// Export All
// ============================================================================

export default ErrorBoundary;
