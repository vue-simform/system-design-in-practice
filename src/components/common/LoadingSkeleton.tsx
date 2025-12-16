/**
 * LoadingSkeleton Component
 * 
 * Enhanced skeleton loaders with shimmer animations for better perceived performance.
 * Multiple variants for different content types (post, comment, profile, list).
 * 
 * System Design Concepts:
 * - Perceived Performance: Show content structure before data loads
 * - Progressive Disclosure: Reveal content gradually as it loads
 * - Shimmer Animation: Smooth gradient animation for polished UX
 * - Staggered Delays: Sequential appearance for natural feel
 * - Accessibility: Screen reader announcements for loading state
 * 
 * Props:
 * - count: Number of skeleton items to show (default: 3)
 * - variant: Type of skeleton (post, comment, profile, list, grid)
 * - showShimmer: Enable shimmer animation (default: true)
 * - stagger: Add staggered delays for multiple items (default: true)
 * 
 * Usage:
 * ```tsx
 * <LoadingSkeleton variant="post" count={5} />
 * <LoadingSkeleton variant="comment" count={3} />
 * <LoadingSkeleton variant="profile" />
 * ```
 */

interface LoadingSkeletonProps {
  count?: number;
  variant?: 'post' | 'comment' | 'profile' | 'list' | 'grid';
  showShimmer?: boolean;
  stagger?: boolean;
}

export function LoadingSkeleton({ 
  count = 3, 
  variant = 'post',
  showShimmer = true,
  stagger = true,
}: LoadingSkeletonProps) {
  // Render different variants
  switch (variant) {
    case 'comment':
      return <CommentSkeleton count={count} showShimmer={showShimmer} stagger={stagger} />;
    case 'profile':
      return <ProfileSkeleton showShimmer={showShimmer} />;
    case 'list':
      return <ListSkeleton count={count} showShimmer={showShimmer} stagger={stagger} />;
    case 'grid':
      return <GridSkeleton count={count} showShimmer={showShimmer} stagger={stagger} />;
    case 'post':
    default:
      return <PostSkeleton count={count} showShimmer={showShimmer} stagger={stagger} />;
  }
}

// ============================================================================
// Base Skeleton Components
// ============================================================================

interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

function Skeleton({ className = '', shimmer = true }: SkeletonProps) {
  return (
    <div 
      className={`bg-gray-200  rounded ${shimmer ? 'skeleton-shimmer' : 'animate-pulse'} ${className}`}
      aria-hidden="true"
    />
  );
}

function SkeletonCircle({ className = '', shimmer = true }: SkeletonProps) {
  return (
    <div 
      className={`bg-gray-200 rounded-full ${shimmer ? 'skeleton-shimmer' : 'animate-pulse'} ${className}`}
      aria-hidden="true"
    />
  );
}

// ============================================================================
// Post Skeleton
// ============================================================================

interface SkeletonVariantProps {
  count?: number;
  showShimmer?: boolean;
  stagger?: boolean;
}

function PostSkeleton({ count = 3, showShimmer = true, stagger = true }: SkeletonVariantProps) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading posts">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          style={stagger ? { animationDelay: `${index * 100}ms` } : undefined}
        >
          {/* Header */}
          <div className="flex items-center mb-4">
            <SkeletonCircle className="w-12 h-12" shimmer={showShimmer} />
            <div className="ml-3 flex-1 space-y-2">
              <Skeleton className="h-4 w-32" shimmer={showShimmer} />
              <Skeleton className="h-3 w-24" shimmer={showShimmer} />
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2 mb-4">
            <Skeleton className="h-4 w-full" shimmer={showShimmer} />
            <Skeleton className="h-4 w-5/6" shimmer={showShimmer} />
            <Skeleton className="h-4 w-4/6" shimmer={showShimmer} />
          </div>

          {/* Optional Media */}
          {index % 2 === 0 && (
            <Skeleton className="h-48 w-full mb-4" shimmer={showShimmer} />
          )}

          {/* Actions */}
          <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
            <Skeleton className="h-4 w-16" shimmer={showShimmer} />
            <Skeleton className="h-4 w-16" shimmer={showShimmer} />
            <Skeleton className="h-4 w-16" shimmer={showShimmer} />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading posts...</span>
    </div>
  );
}

// ============================================================================
// Comment Skeleton
// ============================================================================

function CommentSkeleton({ count = 3, showShimmer = true, stagger = true }: SkeletonVariantProps) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading comments">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex gap-3"
          style={stagger ? { animationDelay: `${index * 80}ms` } : undefined}
        >
          <SkeletonCircle className="w-8 h-8 shrink-0" shimmer={showShimmer} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" shimmer={showShimmer} />
            <Skeleton className="h-4 w-full" shimmer={showShimmer} />
            <Skeleton className="h-4 w-4/5" shimmer={showShimmer} />
            <div className="flex gap-3 pt-1">
              <Skeleton className="h-3 w-12" shimmer={showShimmer} />
              <Skeleton className="h-3 w-12" shimmer={showShimmer} />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">Loading comments...</span>
    </div>
  );
}

// ============================================================================
// Profile Skeleton
// ============================================================================

function ProfileSkeleton({ showShimmer = true }: Omit<SkeletonVariantProps, 'count' | 'stagger'>) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" role="status" aria-label="Loading profile">
      {/* Profile Header */}
      <div className="flex items-start gap-6 mb-6">
        <SkeletonCircle className="w-24 h-24" shimmer={showShimmer} />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-48" shimmer={showShimmer} />
          <Skeleton className="h-4 w-32" shimmer={showShimmer} />
          <Skeleton className="h-4 w-full max-w-md" shimmer={showShimmer} />
          <Skeleton className="h-4 w-3/4 max-w-md" shimmer={showShimmer} />
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-8 pt-6 border-t border-gray-100">
        <div className="space-y-1">
          <Skeleton className="h-6 w-12" shimmer={showShimmer} />
          <Skeleton className="h-3 w-16" shimmer={showShimmer} />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-6 w-12" shimmer={showShimmer} />
          <Skeleton className="h-3 w-16" shimmer={showShimmer} />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-6 w-12" shimmer={showShimmer} />
          <Skeleton className="h-3 w-16" shimmer={showShimmer} />
        </div>
      </div>
      <span className="sr-only">Loading profile...</span>
    </div>
  );
}

// ============================================================================
// List Skeleton
// ============================================================================

function ListSkeleton({ count = 5, showShimmer = true, stagger = true }: SkeletonVariantProps) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading list">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
          style={stagger ? { animationDelay: `${index * 60}ms` } : undefined}
        >
          <SkeletonCircle className="w-10 h-10" shimmer={showShimmer} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" shimmer={showShimmer} />
            <Skeleton className="h-3 w-32" shimmer={showShimmer} />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading list...</span>
    </div>
  );
}

// ============================================================================
// Grid Skeleton
// ============================================================================

function GridSkeleton({ count = 6, showShimmer = true, stagger = true }: SkeletonVariantProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4" role="status" aria-label="Loading grid">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3"
          style={stagger ? { animationDelay: `${index * 80}ms` } : undefined}
        >
          <Skeleton className="h-32 w-full" shimmer={showShimmer} />
          <Skeleton className="h-4 w-3/4" shimmer={showShimmer} />
          <Skeleton className="h-3 w-1/2" shimmer={showShimmer} />
        </div>
      ))}
      <span className="sr-only">Loading grid...</span>
    </div>
  );
}
