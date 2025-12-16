/**
 * NewPostsIndicator Component
 * 
 * Shows a sticky banner when new posts are available from real-time updates.
 * Non-intrusive - user chooses when to load new content.
 * 
 * System Design Concepts:
 * - Progressive Disclosure: Show info, let user decide
 * - Non-intrusive UI: Don't force updates
 * - Smooth Animations: Fade in/out, smooth scroll
 * - Accessibility: Keyboard accessible, ARIA labels
 */

interface NewPostsIndicatorProps {
  count: number;
  onLoad: () => void;
  connectionStatus?: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
}

/**
 * Displays a sticky banner showing number of new posts available
 * 
 * Features:
 * - Sticky positioning at top of feed
 * - Fade-in animation
 * - Click to load new posts
 * - Shows connection status
 * - Smooth scroll to top when loading
 * 
 * @param count - Number of new posts available
 * @param onLoad - Callback to load new posts
 * @param connectionStatus - Current WebSocket connection status
 */
export function NewPostsIndicator({ count, onLoad, connectionStatus }: NewPostsIndicatorProps) {
  if (count === 0) return null;

  return (
    <div className="sticky top-0 z-30 py-3 animate-slide-in">
      <div className="max-w-2xl mx-auto px-4">
        <button
          onClick={onLoad}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-full py-3 px-6 font-medium transition-all shadow-lg hover:shadow-xl active:scale-98 flex items-center justify-center gap-2"
          aria-label={`Load ${count} new ${count === 1 ? 'post' : 'posts'}`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M5 15l7-7 7 7" />
          </svg>
          <span>
            {count} new {count === 1 ? 'post' : 'posts'}
          </span>
        </button>
      </div>

      {/* Connection Status Badge (optional) */}
      {connectionStatus && connectionStatus !== 'connected' && (
        <div className="max-w-2xl mx-auto px-4 mt-2">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              connectionStatus === 'connecting'
                ? 'bg-yellow-100 text-yellow-800'
                : connectionStatus === 'reconnecting'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span>
              {connectionStatus === 'connecting'
                ? 'Connecting...'
                : connectionStatus === 'reconnecting'
                ? 'Reconnecting...'
                : 'Disconnected'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Connection Status Badge Component
 * 
 * Displays current WebSocket connection status in the UI
 * 
 * @param status - Current connection status
 */
export function ConnectionStatusBadge({ status }: { status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          text: 'Live',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          dotColor: 'bg-green-500',
          animate: false,
        };
      case 'connecting':
        return {
          text: 'Connecting',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          dotColor: 'bg-yellow-500',
          animate: true,
        };
      case 'reconnecting':
        return {
          text: 'Reconnecting',
          bgColor: 'bg-orange-100',
          textColor: 'text-orange-800',
          dotColor: 'bg-orange-500',
          animate: true,
        };
      case 'disconnected':
        return {
          text: 'Offline',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          dotColor: 'bg-red-500',
          animate: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
      aria-label={`Connection status: ${config.text}`}
    >
      <div
        className={`w-2 h-2 rounded-full ${config.dotColor} ${
          config.animate ? 'animate-pulse' : ''
        }`}
      />
      <span>{config.text}</span>
    </div>
  );
}
