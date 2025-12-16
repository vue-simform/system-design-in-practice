/**
 * CommentForm Component
 * 
 * Input form for adding new comments or replies.
 * Enhanced with comprehensive validation (Feature #6).
 * 
 * System Design Concepts:
 * - Real-time Validation: useFormValidation hook with debouncing
 * - Character Limits: Visual feedback at 80% capacity
 * - User Feedback: Character counter, validation errors, loading states
 * - Accessibility: ARIA labels, error announcements, keyboard navigation
 * 
 * Features (Enhanced):
 * - Real-time validation with error messages
 * - Auto-expanding textarea
 * - Character counter with warning colors
 * - Submit and cancel buttons
 * - Loading state during submission
 * - Accessible error handling
 * - Auto-focus option
 * - Keyboard shortcuts (Cmd/Ctrl + Enter)
 * 
 * Props:
 * - onSubmit: Callback when form is submitted
 * - onCancel: Optional callback for cancel button
 * - placeholder: Placeholder text
 * - isSubmitting: Loading state
 * - autoFocus: Auto-focus textarea on mount
 * - maxLength: Maximum character limit (default: 1000)
 * 
 * Usage:
 * ```tsx
 * <CommentForm
 *   onSubmit={(text) => addComment({ text })}
 *   placeholder="Write a comment..."
 *   isSubmitting={isPending}
 * />
 * ```
 */

import { useRef, useEffect, type KeyboardEvent } from 'react';
import { useFormValidation } from '../../hooks/useFormValidation';
import { commentValidationSchema } from '../../utils/validation';
import { CharacterCounter } from '../common';

interface CommentFormProps {
  onSubmit: (text: string) => void | Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  isSubmitting?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

export function CommentForm({
  onSubmit,
  onCancel,
  placeholder = 'Write a comment...',
  isSubmitting = false,
  autoFocus = false,
  maxLength = 1000,
}: CommentFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Form validation
  const {
    values,
    errors,
    showError,
    handleChange,
    handleBlur,
    handleSubmit: handleFormSubmit,
    handleReset,
  } = useFormValidation({
    initialValues: {
      comment: '',
    },
    validationSchema: commentValidationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 300,
    onSubmit: async (formValues) => {
      await onSubmit(formValues.comment.trim());
      // Reset form after successful submission
      handleReset();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    },
  });

  // Auto-focus textarea if requested
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [values.comment]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleFormSubmit();
    }
  };

  const handleCancel = () => {
    handleReset();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onCancel?.();
  };

  const isValid = values.comment.trim().length > 0 && values.comment.length <= maxLength && !showError('comment');
  const showCharacterCount = values.comment.length > maxLength * 0.8;

  return (
    <form onSubmit={handleFormSubmit} className="space-y-2">
      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="comment"
          name="comment"
          value={values.comment}
          onChange={handleChange('comment')}
          onBlur={handleBlur('comment')}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSubmitting}
          aria-invalid={showError('comment')}
          aria-describedby={showError('comment') ? 'comment-error' : undefined}
          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none min-h-20 max-h-[200px] disabled:opacity-50 disabled:cursor-not-allowed ${
            showError('comment')
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }`}
        />
        
        {/* Validation Error */}
        {showError('comment') && (
          <p
            id="comment-error"
            className="mt-1 text-sm text-red-600 flex items-center gap-1"
            role="alert"
            aria-live="polite"
          >
            <svg
              className="w-4 h-4 shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{errors.comment}</span>
          </p>
        )}
        
        {/* Character Counter */}
        {showCharacterCount && !showError('comment') && (
          <div className="mt-1 flex justify-end">
            <CharacterCounter
              current={values.comment.length}
              max={maxLength}
              showRemaining={true}
              warningThreshold={maxLength * 0.2}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Tip: Press Cmd/Ctrl + Enter to submit
        </div>
        
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          )}
          
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Posting...
              </span>
            ) : (
              'Comment'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
