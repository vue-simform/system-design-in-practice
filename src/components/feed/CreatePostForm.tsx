/**
 * CreatePostForm Component
 * 
 * System Design Concepts:
 * 1. Form State Management - Controlled inputs with validation
 * 2. Client-side Validation - Real-time feedback with useFormValidation hook
 * 3. Optimistic UI - Instant feedback on post creation
 * 4. Draft Auto-Save - Prevent data loss
 * 5. Progressive Enhancement - Advanced features like image upload
 * 6. Accessibility - ARIA labels, keyboard navigation, error announcements
 * 7. User Feedback - Character counter, loading states, error messages
 * 
 * Feature #6: Client-Side Validation - Enhanced with comprehensive validation
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useCreatePost } from '../../hooks/useCreatePost';
import { useDraftAutoSave, useRestoreDraft } from '../../hooks/useDraftAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { postValidationSchema } from '../../utils/validation';
import { POST_VALIDATION_RULES, type ImageFile } from '../../types';
import { OptimisticIndicator, RollbackToast } from '../common/OptimisticUI';

/**
 * CreatePostForm component for creating new posts
 * 
 * Features (Enhanced with Feature #6 & #7):
 * - Real-time validation with useFormValidation hook
 * - Auto-expanding textarea
 * - Character counter with visual feedback
 * - Image upload with preview
 * - Accessible error messages (ARIA)
 * - Draft auto-save every 3 seconds
 * - Optimistic UI updates with temp IDs (Feature #7)
 * - Visual feedback for optimistic states (Feature #7)
 * - Keyboard shortcuts (Cmd/Ctrl + Enter to submit)
 * - Loading states
 * - Comprehensive error handling
 */
export function CreatePostForm() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hooks (Enhanced with Feature #7)
  const { createPost, isPending, optimisticState, error } = useCreatePost({
    onSuccess: () => {
      // Clear form on success
      handleReset();
      clearDraft();
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    },
  });

  // Form validation
  const {
    values,
    errors,
    showError,
    handleChange,
    handleBlur,
    handleSubmit,
    handleReset,
  } = useFormValidation({
    initialValues: {
      title: '',
      content: '',
    },
    validationSchema: postValidationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 300,
    onSubmit: async (formValues) => {
      // Submit post
      createPost({
        content: formValues.content.trim(),
        mediaUrls: images.map((img) => img.preview),
      });
    },
  });

  // Draft auto-save
  const { clearDraft, lastSaved } = useDraftAutoSave({
    content: values.content,
    mediaUrls: images.map((img) => img.preview),
    enabled: !isPending,
  });

  // Restore draft on mount
  useRestoreDraft((draft) => {
    handleChange('content')({ target: { value: draft.content } } as any);
  });

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  /**
   * Auto-expand textarea as user types
   */
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight (content height)
    const newHeight = Math.min(textarea.scrollHeight, 300); // Max 300px
    textarea.style.height = `${newHeight}px`;
  }, [values.content]);

  /**
   * Handle image file selection
   */
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate and process files
    const newImages: ImageFile[] = [];

    Array.from(files).forEach((file) => {
      // Type validation
      if (!POST_VALIDATION_RULES.ALLOWED_IMAGE_TYPES.includes(file.type as typeof POST_VALIDATION_RULES.ALLOWED_IMAGE_TYPES[number])) {
        alert(`Invalid file type: ${file.type}. Allowed: JPG, PNG, GIF, WebP`);
        return;
      }

      // Size validation
      if (file.size > POST_VALIDATION_RULES.MAX_IMAGE_SIZE) {
        alert(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Max: 5MB`);
        return;
      }

      // Check total images
      if (images.length + newImages.length >= POST_VALIDATION_RULES.MAX_IMAGES) {
        alert(`Maximum ${POST_VALIDATION_RULES.MAX_IMAGES} images allowed`);
        return;
      }

      // Create preview URL
      const preview = URL.createObjectURL(file);
      
      newImages.push({
        id: `img-${Date.now()}-${Math.random()}`,
        file,
        preview,
        size: file.size,
        type: file.type,
      });
    });

    setImages((prev) => [...prev, ...newImages]);
    
    // Reset input
    e.target.value = '';
  };

  /**
   * Remove image from selection
   */
  const handleRemoveImage = (imageId: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === imageId);
      if (image) {
        // Revoke object URL to prevent memory leaks
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter((img) => img.id !== imageId);
    });
  };

  // Calculate character count percentage
  const charCount = values.content.length;
  const charLimit = POST_VALIDATION_RULES.MAX_CONTENT_LENGTH;
  const charPercentage = (charCount / charLimit) * 100;
  const showCharCounter = charPercentage >= 80;
  const isOverLimit = charCount > charLimit;

  // Check if form can be submitted
  const canSubmit = !isPending && (values.content.trim().length > 0 || images.length > 0) && !isOverLimit;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <img
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=user1"
          alt="Your avatar"
          className="w-10 h-10 rounded-full"
        />
        <div>
          <p className="font-semibold text-sm">Create a post</p>
          {lastSaved && (
            <p className="text-xs text-gray-500">
              Draft saved {new Date(lastSaved).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Content Textarea with Validation */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="content"
          name="content"
          value={values.content}
          onChange={handleChange('content')}
          onBlur={handleBlur('content')}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind?"
          disabled={isPending}
          aria-invalid={showError('content')}
          aria-describedby={showError('content') ? 'content-error' : undefined}
          className={`w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed ${
            showError('content')
              ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500'
          }`}
          style={{ minHeight: '80px', maxHeight: '300px' }}
        />
        
        {/* Validation Error */}
        {showError('content') && (
          <p
            id="content-error"
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
            <span>{errors.content}</span>
          </p>
        )}
      </div>

      {/* Character Counter */}
      {showCharCounter && (
        <div className="flex justify-end mt-2">
          <span
            className={`text-sm font-medium ${
              isOverLimit ? 'text-red-600' : 'text-gray-500'
            }`}
          >
            {charCount} / {charLimit}
          </span>
        </div>
      )}

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          {images.map((image) => (
            <div key={image.id} className="relative group">
              <img
                src={image.preview}
                alt="Preview"
                className="w-full h-24 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(image.id)}
                disabled={isPending}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2">
          {/* Image Upload */}
          <label
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer ${
              isPending || images.length >= POST_VALIDATION_RULES.MAX_IMAGES
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>Photo</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              disabled={isPending || images.length >= POST_VALIDATION_RULES.MAX_IMAGES}
              className="hidden"
              aria-label="Upload images"
            />
          </label>

          {/* Image count */}
          {images.length > 0 && (
            <span className="text-xs text-gray-500">
              {images.length} / {POST_VALIDATION_RULES.MAX_IMAGES}
            </span>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            canSubmit
              ? 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          aria-label="Post"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Posting...
            </span>
          ) : (
            'Post'
          )}
        </button>
      </div>

      {/* Keyboard Shortcut Hint */}
      <div className="mt-2 text-xs text-gray-400 text-right">
        Press {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'} + Enter to post
      </div>

      {/* Optimistic Update Indicator (Feature #7) */}
      {(optimisticState.isOptimistic || optimisticState.isRollingBack || optimisticState.isSuccess) && (
        <div className="mt-3">
          <OptimisticIndicator
            isOptimistic={optimisticState.isOptimistic}
            isPending={optimisticState.isPending}
            isRollingBack={optimisticState.isRollingBack}
            isSuccess={optimisticState.isSuccess}
            isError={optimisticState.isError}
            position="inline"
            showIcon={true}
            className="text-xs"
            pendingMessage="Creating post..."
            successMessage="Post created!"
            rollbackMessage="Undoing..."
            errorMessage="Failed to create post"
          />
        </div>
      )}

      {/* Rollback Toast for errors (Feature #7) */}
      <RollbackToast
        isActive={optimisticState.isRollingBack}
        resource="post"
        error={error}
        onRetry={() => {
          // Retry with current values
          createPost({
            content: values.content.trim(),
            mediaUrls: images.map((img) => img.preview),
          });
        }}
        showRetry={true}
      />
    </div>
  );
}
