/**
 * Profile Page Component
 * 
 * Displays user profile with:
 * - Profile header (avatar, name, bio, stats, follow button)
 * - User's posts feed with filtering
 * - Lazy loaded for code splitting
 * 
 * System Design Concepts:
 * - Route-based code splitting (lazy loading)
 * - Normalized state (shared user data)
 * - Separate timeline implementation
 */

import { useParams, Link } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';
import { sessionPersistentStorage } from '../utils/statePersistence';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileFeed } from '../components/profile/ProfileFeed';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';

export function Profile() {
  const { userId } = useParams<{ userId: string }>();
  
  const { data, isLoading, isError, error } = useUserProfile(userId);

  // Save current profile scroll position before navigating back to feed
  const handleBackToFeed = () => {
    const scrollY = window.scrollY;
    sessionPersistentStorage.set(`scroll-profile-${userId}`, {
      x: 0,
      y: scrollY,
      timestamp: Date.now(),
    });
  };

  // No userId in URL
  if (!userId) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">User not found</h3>
        <p className="text-gray-500 mb-4">The user ID is missing from the URL.</p>
        <Link
          to="/"
          onClick={handleBackToFeed}
          className="text-blue-500 hover:text-blue-600 font-medium"
        >
          ← Back to Feed
        </Link>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <LoadingSkeleton count={1} />
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-900 mb-2">Failed to load profile</h3>
          <p className="text-red-600 mb-4">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <Link
            to="/"
            onClick={handleBackToFeed}
            className="text-red-600 hover:text-red-700 font-medium"
          >
            ← Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <Link
        to="/"
        onClick={handleBackToFeed}
        className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Feed
      </Link>

      {/* Profile Header */}
      {data?.user && <ProfileHeader profile={data.user} />}

      {/* User Posts */}
      <ProfileFeed userId={userId} />
    </div>
  );
}
