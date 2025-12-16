/**
 * CommentCard Component
 * 
 * Displays a single comment with user info, text, and actions.
 * Supports recursive rendering for nested replies.
 * 
 * System Design Concepts:
 * - Recursive Components: Renders itself for nested replies
 * - Tree Structure Visualization: Shows parent-child relationships
 * - Progressive Disclosure: Reply button reveals reply form
 * - Lazy Loading: Nested replies loaded efficiently
 * 
 * Features:
 * - Author avatar and name
 * - Comment text with proper formatting
 * - Timestamp (relative time)
 * - Reply button (toggles reply form)
 * - Nested replies with visual indentation
 * - Recursive rendering for unlimited depth
 * 
 * Props:
 * - comment: Comment object with potential replies
 * - depth: Current nesting level (for styling)
 * - onReply: Callback when replying to this comment
 * 
 * Usage:
 * ```tsx
 * <CommentCard 
 *   comment={comment} 
 *   depth={0}
 *   onReply={(parentId, text) => addComment({ text, parentId })}
 * />
 * ```
 */

import { memo, useState } from 'react';
import type { Comment } from '../../types';
import { formatRelativeTime } from '../../utils/helpers';
import { CommentForm } from './CommentForm';

interface CommentCardProps {
  comment: Comment;
  depth?: number;
  maxDepth?: number;
  onReply: (parentId: string, text: string) => void;
  isReplying?: boolean;
}

export const CommentCard = memo(({ 
  comment, 
  depth = 0,
  maxDepth = 5,
  onReply,
  isReplying = false
}: CommentCardProps) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate indentation based on depth
  const indentClass = depth > 0 ? 'ml-8 md:ml-12' : '';
  
  // Limit nesting depth to prevent excessive indentation
  const hasReplies = comment.replies && comment.replies.length > 0;
  const canReply = depth < maxDepth;

  const handleReplySubmit = async (text: string) => {
    setIsSubmitting(true);
    try {
      await onReply(comment.id, text);
      setShowReplyForm(false);
    } catch (error) {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${indentClass}`}>
      <div className="flex gap-3 group">
        {/* Avatar */}
        <div className="shrink-0">
          <div className="w-8 h-8 bg-linear-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            {comment.user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>

        {/* Comment Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-50 rounded-lg p-3">
            {/* Author and Timestamp */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-900">
                {comment.user?.name || 'Unknown User'}
              </span>
              <span className="text-xs text-gray-500">
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>

            {/* Comment Text */}
            <p className="text-sm text-gray-800 whitespace-pre-wrap wrap-break-word">
              {comment.text}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2 ml-3">
            {canReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-xs font-medium text-gray-600 hover:text-blue-600 transition-colors"
                disabled={isReplying}
              >
                {showReplyForm ? 'Cancel' : 'Reply'}
              </button>
            )}

            {hasReplies && (
              <span className="text-xs text-gray-500">
                {comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}
              </span>
            )}
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <div className="mt-3">
              <CommentForm
                onSubmit={handleReplySubmit}
                placeholder={`Reply to ${comment.user?.name || 'this comment'}...`}
                isSubmitting={isSubmitting}
                autoFocus
              />
            </div>
          )}

          {/* Nested Replies - RECURSIVE RENDERING */}
          {hasReplies && (
            <div className="mt-3 space-y-3">
              {comment.replies!.map((reply) => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                  onReply={onReply}
                  isReplying={isSubmitting}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

CommentCard.displayName = 'CommentCard';
