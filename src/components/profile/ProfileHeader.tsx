/**
 * ProfileHeader Component
 * 
 * Displays user profile information including:
 * - Avatar, name, username
 * - Bio
 * - Stats (followers, following, posts)
 * - Follow/Unfollow button with optimistic updates
 * 
 * System Design: Optimistic UI updates for instant feedback
 */

import { useToggleFollow } from '../../hooks/useUserProfile';
import type { UserProfile } from '../../types';

interface ProfileHeaderProps {
  profile: UserProfile;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const { toggle: toggleFollow, isLoading: isFollowLoading } = useToggleFollow();

  const handleFollowClick = () => {
    toggleFollow(profile.id, profile.isFollowing || false);
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Cover Image Placeholder */}
      <div className="h-32 bg-linear-to-r from-blue-500 to-purple-600" />

      {/* Profile Info */}
      <div className="px-6 pb-6">
        {/* Avatar */}
        <div className="flex items-start justify-between -mt-12 mb-4">
          <img
            src={profile.avatar}
            alt={profile.name}
            className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
          />
          
          {/* Follow Button */}
          <button
            onClick={handleFollowClick}
            disabled={isFollowLoading}
            className={`
              mt-14 px-6 py-2 rounded-full font-medium transition-all
              ${profile.isFollowing
                ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                : 'bg-blue-500 text-white hover:bg-blue-600'
              }
              ${isFollowLoading ? 'opacity-50 cursor-not-allowed' : ''}
              disabled:opacity-50
            `}
          >
            {isFollowLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {profile.isFollowing ? 'Unfollowing...' : 'Following...'}
              </span>
            ) : (
              profile.isFollowing ? 'Following' : 'Follow'
            )}
          </button>
        </div>

        {/* Name & Username */}
        <div className="mb-3">
          <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
          <p className="text-gray-500">@{profile.username}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-gray-700 mb-4">{profile.bio}</p>
        )}

        {/* Stats */}
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center">
            <span className="font-bold text-gray-900 mr-1">
              {formatCount(profile.postCount)}
            </span>
            <span className="text-gray-500">Posts</span>
          </div>
          
          <div className="flex items-center">
            <span className="font-bold text-gray-900 mr-1">
              {formatCount(profile.followerCount)}
            </span>
            <span className="text-gray-500">Followers</span>
          </div>
          
          <div className="flex items-center">
            <span className="font-bold text-gray-900 mr-1">
              {formatCount(profile.followingCount)}
            </span>
            <span className="text-gray-500">Following</span>
          </div>
        </div>

        {/* Join Date */}
        <div className="mt-4 text-sm text-gray-500">
          Joined {new Date(profile.joinedAt).toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
          })}
        </div>
      </div>
    </div>
  );
}
