/**
 * Hook for auto-saving post drafts to localStorage
 * 
 * System Design Concepts:
 * 1. Data Persistence - Save form state to prevent data loss
 * 2. Debouncing - Limit save frequency to reduce localStorage writes
 * 3. Local Storage - Browser-based persistence without server calls
 * 4. Auto-recovery - Restore draft on page refresh
 * 5. Graceful Cleanup - Clear draft after successful post
 * 6. TTL Management - Auto-expire old drafts
 * 7. Conflict Resolution - Handle multiple tabs/windows
 * 8. Recovery UI - Show visual indicator for restored drafts
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { persistentStorage, TTL, STORAGE_KEYS } from '../utils/statePersistence';
import type { PostDraft } from '../types';

const AUTO_SAVE_DELAY = 3000; // 3 seconds

interface UseDraftAutoSaveOptions {
  content: string;
  mediaUrls: string[];
  enabled?: boolean;
  draftKey?: string; // Allow different draft keys for comments, posts, etc.
}

interface UseDraftAutoSaveReturn {
  loadDraft: () => PostDraft | null;
  saveDraft: () => void;
  clearDraft: () => void;
  hasDraft: () => boolean;
  lastSaved: Date | null;
  draftAge: number | null; // Age of draft in milliseconds
  showRecoveryNotice: boolean; // Show UI notice that draft was restored
  dismissRecoveryNotice: () => void;
}

/**
 * Custom hook for auto-saving post drafts to localStorage
 * 
 * Features:
 * - Auto-save every 3 seconds when content changes
 * - Debouncing to prevent excessive writes
 * - Load draft on mount
 * - Clear draft after successful post
 * - Check if draft exists
 * 
 * @param options - Content and media URLs to save
 * @returns Draft management functions
 * 
 * @example
 * ```tsx
 * const {loadDraft, clearDraft, lastSaved} = useDraftAutoSave({
 *   content,
 *   mediaUrls,
 *   enabled: content.length > 0
 * });
 * 
 * // Load draft on mount
 * useEffect(() => {
 *   const draft = loadDraft();
 *   if (draft) {
 *     setContent(draft.content);
 *     setMediaUrls(draft.mediaUrls);
 *   }
 * }, []);
 * 
 * // Clear after successful post
 * const handleSuccess = () => {
 *   clearDraft();
 *   setContent('');
 * };
 * ```
 */
export function useDraftAutoSave({
  content,
  mediaUrls,
  enabled = true,
  draftKey = STORAGE_KEYS.POST_DRAFT,
}: UseDraftAutoSaveOptions): UseDraftAutoSaveReturn {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSavedRef = useRef<Date | null>(null);
  const [showRecoveryNotice, setShowRecoveryNotice] = useState(false);
  const [draftAge, setDraftAge] = useState<number | null>(null);

  /**
   * Save draft to localStorage with TTL
   */
  const saveDraft = useCallback(() => {
    if (!enabled || (content.trim().length === 0 && mediaUrls.length === 0)) {
      return;
    }

    try {
      const draft: PostDraft = {
        content: content.trim(),
        mediaUrls,
        lastSaved: new Date().toISOString(),
      };

      // Save with 7-day TTL
      const success = persistentStorage.set(draftKey, draft, { ttl: TTL.ONE_WEEK });
      
      if (success) {
        lastSavedRef.current = new Date();
      }
    } catch (error) {
    }
  }, [content, mediaUrls, enabled, draftKey]);

  /**
   * Load draft from localStorage (TTL handled automatically)
   */
  const loadDraft = useCallback((): PostDraft | null => {
    try {
      const draft = persistentStorage.get<PostDraft>(draftKey);
      
      if (draft) {
        // Calculate draft age
        const age = Date.now() - new Date(draft.lastSaved).getTime();
        setDraftAge(age);
        setShowRecoveryNotice(true);
      }

      return draft;
    } catch (error) {
      return null;
    }
  }, [draftKey]);

  /**
   * Clear draft from localStorage
   */
  const clearDraft = useCallback(() => {
    try {
      persistentStorage.remove(draftKey);
      lastSavedRef.current = null;
      setDraftAge(null);
      setShowRecoveryNotice(false);
    } catch (error) {
    }
  }, [draftKey]);

  /**
   * Check if draft exists
   */
  const hasDraft = useCallback((): boolean => {
    return persistentStorage.has(draftKey);
  }, [draftKey]);

  /**
   * Dismiss recovery notice
   */
  const dismissRecoveryNotice = useCallback(() => {
    setShowRecoveryNotice(false);
  }, []);

  /**
   * Auto-save with debouncing
   * Saves draft 3 seconds after user stops typing
   */
  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only auto-save if there's content
    if (content.trim().length > 0 || mediaUrls.length > 0) {
      timeoutRef.current = setTimeout(() => {
        saveDraft();
      }, AUTO_SAVE_DELAY);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, mediaUrls, enabled, saveDraft]);

  return {
    loadDraft,
    saveDraft,
    clearDraft,
    hasDraft,
    lastSaved: lastSavedRef.current,
    draftAge,
    showRecoveryNotice,
    dismissRecoveryNotice,
  };
}

/**
 * Helper hook to restore draft on component mount
 * 
 * @example
 * ```tsx
 * const [content, setContent] = useState('');
 * const [mediaUrls, setMediaUrls] = useState<string[]>([]);
 * 
 * useRestoreDraft((draft) => {
 *   setContent(draft.content);
 *   setMediaUrls(draft.mediaUrls);
 * });
 * ```
 */
export function useRestoreDraft(
  onRestore: (draft: PostDraft) => void
): { hasRestoredDraft: boolean } {
  const hasRestoredRef = useRef(false);
  const { loadDraft } = useDraftAutoSave({
    content: '',
    mediaUrls: [],
    enabled: false,
  });

  useEffect(() => {
    if (hasRestoredRef.current) return;

    const draft = loadDraft();
    if (draft) {
      onRestore(draft);
      hasRestoredRef.current = true;
    }
  }, [loadDraft, onRestore]);

  return { hasRestoredDraft: hasRestoredRef.current };
}
