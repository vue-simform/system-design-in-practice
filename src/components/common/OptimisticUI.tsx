/**
 * Optimistic Update UI Components
 * 
 * Visual feedback components for optimistic updates:
 * - OptimisticIndicator: Shows saving/syncing status
 * - RollbackToast: Notification when rollback occurs
 * - OptimisticStats: Display statistics for all optimistic updates
 * - PendingUpdatesList: List all pending optimistic operations
 * 
 * Part of Feature #7: Optimistic Updates
 */

import React from 'react';
import { useOptimisticStats, usePendingOptimisticUpdates, useFailedOptimisticUpdates } from '../../hooks/useOptimisticMutation';

// ============================================================================
// Simple SVG Icons
// ============================================================================

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ArrowPathIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ExclamationTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

// ============================================================================
// Optimistic Indicator Component
// ============================================================================

interface OptimisticIndicatorProps {
  /** Is optimistic update in progress? */
  isOptimistic: boolean;
  
  /** Is operation pending? */
  isPending: boolean;
  
  /** Is rollback in progress? */
  isRollingBack: boolean;
  
  /** Did operation succeed? */
  isSuccess: boolean;
  
  /** Did operation fail? */
  isError: boolean;
  
  /** Custom success message */
  successMessage?: string;
  
  /** Custom pending message */
  pendingMessage?: string;
  
  /** Custom rollback message */
  rollbackMessage?: string;
  
  /** Custom error message */
  errorMessage?: string;
  
  /** Show icon with message */
  showIcon?: boolean;
  
  /** Position of the indicator */
  position?: 'inline' | 'fixed-bottom' | 'fixed-top';
  
  /** Custom CSS class */
  className?: string;
}

/**
 * OptimisticIndicator Component
 * 
 * Shows visual feedback for optimistic update states:
 * - Pending: Spinning icon with "Saving..." message
 * - Success: Checkmark with "Saved!" message
 * - Error: X icon with "Failed" message
 * - Rolling back: Undo icon with "Undoing..." message
 * 
 * @example
 * <OptimisticIndicator 
 *   isOptimistic={state.isOptimistic}
 *   isPending={state.isPending}
 *   isRollingBack={state.isRollingBack}
 *   isSuccess={!state.isPending && !state.error}
 *   isError={!!state.error}
 * />
 */
export function OptimisticIndicator({
  isOptimistic,
  isPending,
  isRollingBack,
  isSuccess,
  isError,
  successMessage = 'Saved!',
  pendingMessage = 'Saving...',
  rollbackMessage = 'Undoing changes...',
  errorMessage = 'Failed to save',
  showIcon = true,
  position = 'inline',
  className = '',
}: OptimisticIndicatorProps) {
  // Don't show if no state is active
  if (!isOptimistic && !isPending && !isRollingBack && !isSuccess && !isError) {
    return null;
  }

  // Determine current state and styling
  let message = '';
  let icon: React.ReactNode = null;
  let colorClass = '';
  let bgClass = '';

  if (isRollingBack) {
    message = rollbackMessage;
    icon = <ArrowPathIcon className="w-4 h-4 animate-spin" />;
    colorClass = 'text-yellow-600';
    bgClass = 'bg-yellow-50';
  } else if (isPending || isOptimistic) {
    message = pendingMessage;
    icon = <ArrowPathIcon className="w-4 h-4 animate-spin" />;
    colorClass = 'text-blue-600';
    bgClass = 'bg-blue-50';
  } else if (isError) {
    message = errorMessage;
    icon = <XCircleIcon className="w-4 h-4" />;
    colorClass = 'text-red-600';
    bgClass = 'bg-red-50';
  } else if (isSuccess) {
    message = successMessage;
    icon = <CheckCircleIcon className="w-4 h-4" />;
    colorClass = 'text-green-600';
    bgClass = 'bg-green-50';
  }

  // Position-specific classes
  const positionClasses = {
    'inline': 'inline-flex',
    'fixed-bottom': 'fixed bottom-4 right-4 z-50 shadow-lg',
    'fixed-top': 'fixed top-4 right-4 z-50 shadow-lg',
  };

  return (
    <div
      className={`
        ${positionClasses[position]}
        items-center gap-2 px-3 py-2 rounded-lg
        ${bgClass} ${colorClass}
        text-sm font-medium
        transition-all duration-200
        ${className}
      `}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {showIcon && icon}
      <span>{message}</span>
    </div>
  );
}

// ============================================================================
// Rollback Toast Component
// ============================================================================

interface RollbackToastProps {
  /** Is rollback active? */
  isActive: boolean;
  
  /** Resource that was rolled back */
  resource?: string;
  
  /** Error that caused rollback */
  error?: Error | null;
  
  /** Callback when toast is dismissed */
  onDismiss?: () => void;
  
  /** Auto-dismiss after milliseconds (0 to disable) */
  autoDismiss?: number;
  
  /** Show retry button */
  showRetry?: boolean;
  
  /** Retry callback */
  onRetry?: () => void;
}

/**
 * RollbackToast Component
 * 
 * Notification toast when optimistic update is rolled back.
 * Shows error details and optional retry button.
 * 
 * @example
 * <RollbackToast
 *   isActive={state.isRollingBack}
 *   resource="post like"
 *   error={state.error}
 *   onRetry={() => mutation.mutate(variables)}
 * />
 */
export function RollbackToast({
  isActive,
  resource = 'action',
  error,
  onDismiss,
  autoDismiss = 5000,
  showRetry = true,
  onRetry,
}: RollbackToastProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (isActive) {
      setVisible(true);
      
      if (autoDismiss > 0) {
        const timer = setTimeout(() => {
          setVisible(false);
          onDismiss?.();
        }, autoDismiss);
        
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [isActive, autoDismiss, onDismiss]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-md animate-slide-in-up"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">
              Changes were undone
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Failed to save {resource}.{' '}
              {error?.message && (
                <span className="text-gray-500">({error.message})</span>
              )}
            </p>
            
            {showRetry && onRetry && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={onRetry}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Retry
                </button>
                <button
                  onClick={() => {
                    setVisible(false);
                    onDismiss?.();
                  }}
                  className="text-xs font-medium text-gray-600 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
          
          {!showRetry && (
            <button
              onClick={() => {
                setVisible(false);
                onDismiss?.();
              }}
              className="shrink-0 text-gray-400 hover:text-gray-600"
              aria-label="Dismiss"
            >
              <XCircleIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Optimistic Stats Component
// ============================================================================

interface OptimisticStatsProps {
  /** Show detailed breakdown */
  showDetails?: boolean;
  
  /** Position */
  position?: 'inline' | 'fixed';
  
  /** Custom CSS class */
  className?: string;
}

/**
 * OptimisticStats Component
 * 
 * Displays statistics for all optimistic updates:
 * - Total updates tracked
 * - Currently pending
 * - Successful
 * - Failed
 * - Rolled back
 * 
 * Useful for debugging and monitoring.
 * 
 * @example
 * <OptimisticStats showDetails position="fixed" />
 */
export function OptimisticStats({
  showDetails = false,
  position = 'inline',
  className = '',
}: OptimisticStatsProps) {
  const stats = useOptimisticStats();

  if (!showDetails && stats.pending === 0) {
    return null;
  }

  const positionClass = position === 'fixed' ? 'fixed bottom-4 left-4 z-50 shadow-lg' : '';

  return (
    <div
      className={`
        ${positionClass}
        bg-white border border-gray-200 rounded-lg p-3
        text-xs font-medium
        ${className}
      `}
    >
      <h4 className="text-gray-700 font-semibold mb-2">Optimistic Updates</h4>
      
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-600">Total:</span>
          <span className="text-gray-900">{stats.total}</span>
        </div>
        
        {showDetails && (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-blue-600">Pending:</span>
              <span className="text-blue-900 font-semibold">{stats.pending}</span>
            </div>
            
            <div className="flex justify-between gap-4">
              <span className="text-green-600">Success:</span>
              <span className="text-green-900">{stats.success}</span>
            </div>
            
            <div className="flex justify-between gap-4">
              <span className="text-red-600">Failed:</span>
              <span className="text-red-900">{stats.error}</span>
            </div>
            
            <div className="flex justify-between gap-4">
              <span className="text-yellow-600">Rolled back:</span>
              <span className="text-yellow-900">{stats.rolledBack}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Pending Updates List Component
// ============================================================================

interface PendingUpdatesListProps {
  /** Maximum items to show */
  maxItems?: number;
  
  /** Show resource type */
  showResource?: boolean;
  
  /** Custom CSS class */
  className?: string;
}

/**
 * PendingUpdatesList Component
 * 
 * Shows list of all currently pending optimistic updates.
 * Useful for debugging and user feedback.
 * 
 * @example
 * <PendingUpdatesList maxItems={5} showResource />
 */
export function PendingUpdatesList({
  maxItems = 10,
  showResource = true,
  className = '',
}: PendingUpdatesListProps) {
  const updates = usePendingOptimisticUpdates();

  if (updates.length === 0) {
    return null;
  }

  const displayUpdates = updates.slice(0, maxItems);
  const hasMore = updates.length > maxItems;

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <ArrowPathIcon className="w-4 h-4 text-blue-600 animate-spin" />
        <h4 className="text-sm font-semibold text-blue-900">
          Syncing changes ({updates.length})
        </h4>
      </div>
      
      <ul className="space-y-1">
        {displayUpdates.map((update) => (
          <li key={update.id} className="text-xs text-blue-700">
            {showResource && (
              <span className="font-medium">{update.resource}: </span>
            )}
            <span className="capitalize">{update.type}</span>
            <span className="text-blue-500 ml-1">
              ({Math.round((Date.now() - update.timestamp) / 1000)}s ago)
            </span>
          </li>
        ))}
      </ul>
      
      {hasMore && (
        <p className="mt-2 text-xs text-blue-600">
          +{updates.length - maxItems} more...
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Failed Updates List Component
// ============================================================================

interface FailedUpdatesListProps {
  /** Maximum items to show */
  maxItems?: number;
  
  /** Show error details */
  showErrors?: boolean;
  
  /** Retry callback */
  onRetry?: (updateId: string) => void;
  
  /** Custom CSS class */
  className?: string;
}

/**
 * FailedUpdatesList Component
 * 
 * Shows list of failed optimistic updates with retry option.
 * 
 * @example
 * <FailedUpdatesList
 *   maxItems={5}
 *   showErrors
 *   onRetry={(id) => retryUpdate(id)}
 * />
 */
export function FailedUpdatesList({
  maxItems = 10,
  showErrors = false,
  onRetry,
  className = '',
}: FailedUpdatesListProps) {
  const updates = useFailedOptimisticUpdates();

  if (updates.length === 0) {
    return null;
  }

  const displayUpdates = updates.slice(0, maxItems);
  const hasMore = updates.length > maxItems;

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />
        <h4 className="text-sm font-semibold text-red-900">
          Failed changes ({updates.length})
        </h4>
      </div>
      
      <ul className="space-y-2">
        {displayUpdates.map((update) => (
          <li key={update.id} className="text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-red-900">{update.resource}: </span>
                <span className="text-red-700 capitalize">{update.type}</span>
                
                {showErrors && update.error && (
                  <p className="mt-1 text-red-600">{update.error.message}</p>
                )}
              </div>
              
              {onRetry && (
                <button
                  onClick={() => onRetry(update.id)}
                  className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Retry
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      
      {hasMore && (
        <p className="mt-2 text-xs text-red-600">
          +{updates.length - maxItems} more...
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default {
  OptimisticIndicator,
  RollbackToast,
  OptimisticStats,
  PendingUpdatesList,
  FailedUpdatesList,
};
