import { useEffect, useCallback, useRef } from 'react';
import { useSearchFilterStore } from '../../store/searchFilterStore';
import { debounce } from '../../utils/helpers';

/**
 * SearchBar Component
 * 
 * Features:
 * - Debounced search input (300ms delay)
 * - Keyboard shortcut (Cmd/Ctrl + K to focus)
 * - Clear button when text entered
 * - Search icon indicator
 * - Loading state
 * 
 * System Design Concepts:
 * 1. **Debouncing**: Reduces API calls by waiting for user to stop typing
 * 2. **Keyboard Shortcuts**: Improves UX with accessible hotkeys
 * 3. **Controlled Input**: React state manages input value
 * 4. **Accessibility**: ARIA labels, keyboard navigation
 */
export function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    searchQuery,
    setSearchQuery,
    setDebouncedQuery,
    clearSearch,
    setSearchFocused,
  } = useSearchFilterStore();

  // Debounced update function
  const debouncedUpdate = useCallback(
    debounce((value: string) => {
      setDebouncedQuery(value);
    }, 300),
    [setDebouncedQuery]
  );

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    debouncedUpdate(value);
  };

  // Handle clear button
  const handleClear = () => {
    clearSearch();
    inputRef.current?.focus();
  };

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      
      // Escape to clear search
      if (e.key === 'Escape' && searchQuery) {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  return (
    <div className="w-full max-w-2xl mx-auto mb-6">
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleChange}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search posts... (Cmd+K)"
          className="w-full pl-12 pr-12 py-3 rounded-lg border border-gray-300 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                   bg-white text-gray-900 placeholder-gray-400
                   transition-all duration-200"
          aria-label="Search posts"
          autoComplete="off"
        />

        {/* Clear Button */}
        {searchQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-4 flex items-center 
                     text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear search"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Keyboard Hint */}
        {!searchQuery && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold 
                          text-gray-500 bg-gray-100 border border-gray-300 rounded">
              ⌘K
            </kbd>
          </div>
        )}
      </div>

      {/* Search Tips (shown when focused and empty) */}
      {searchQuery === '' && (
        <div className="mt-2 text-sm text-gray-500 text-center">
          Try searching for keywords, hashtags, or usernames
        </div>
      )}
    </div>
  );
}
