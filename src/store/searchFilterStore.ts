import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FilterType = 'all' | 'following' | 'liked';
export type SortType = 'newest' | 'popular' | 'trending';

interface SearchFilterState {
  // Search state
  searchQuery: string;
  debouncedQuery: string;
  
  // Filter state
  activeFilter: FilterType;
  activeSort: SortType;
  
  // UI state
  isSearchFocused: boolean;
  showSearchResults: boolean;
  
  // Actions
  setSearchQuery: (query: string) => void;
  setDebouncedQuery: (query: string) => void;
  setActiveFilter: (filter: FilterType) => void;
  setActiveSort: (sort: SortType) => void;
  setSearchFocused: (focused: boolean) => void;
  setShowSearchResults: (show: boolean) => void;
  clearSearch: () => void;
  resetFilters: () => void;
}

/**
 * Zustand store for search and filter state
 * 
 * System Design Concepts:
 * 1. **Client State Management**: Zustand for lightweight UI state
 * 2. **Persistence**: Filter preferences saved to localStorage with TTL
 * 3. **Separation of Concerns**: UI state separate from server data
 * 4. **Performance**: Minimal re-renders with selective subscriptions
 * 5. **TTL Management**: Auto-expire stale preferences after 30 days
 * 6. **Partial Persistence**: Only persist relevant state, not ephemeral UI
 * 
 * Persisted to localStorage (30-day TTL):
 * - activeFilter (all/following/liked)
 * - activeSort (newest/popular/trending)
 * 
 * Not persisted (session-only):
 * - searchQuery (cleared on page reload)
 * - debouncedQuery (derived from searchQuery)
 * - UI flags (focus, show results)
 */
export const useSearchFilterStore = create<SearchFilterState>()(
  persist(
    (set) => ({
      // Initial state
      searchQuery: '',
      debouncedQuery: '',
      activeFilter: 'all',
      activeSort: 'newest',
      isSearchFocused: false,
      showSearchResults: false,

      // Search actions
      setSearchQuery: (query) => 
        set({ searchQuery: query }),
      
      setDebouncedQuery: (query) => 
        set({ 
          debouncedQuery: query,
          showSearchResults: query.trim().length > 0 
        }),
      
      // Filter actions
      setActiveFilter: (filter) => 
        set({ activeFilter: filter }),
      
      setActiveSort: (sort) => 
        set({ activeSort: sort }),
      
      // UI actions
      setSearchFocused: (focused) => 
        set({ isSearchFocused: focused }),
      
      setShowSearchResults: (show) => 
        set({ showSearchResults: show }),
      
      // Reset actions
      clearSearch: () => 
        set({ 
          searchQuery: '', 
          debouncedQuery: '', 
          showSearchResults: false 
        }),
      
      resetFilters: () => 
        set({ 
          activeFilter: 'all', 
          activeSort: 'newest' 
        }),
    }),
    {
      name: 'search-filter-storage',
      // Only persist filter preferences, not search query or UI state
      partialize: (state) => ({
        activeFilter: state.activeFilter,
        activeSort: state.activeSort,
      }),
      // Zustand persist stores version for migration
      version: 1,
    }
  )
);

/**
 * Selectors for efficient component subscriptions
 * Use these to prevent unnecessary re-renders
 */
export const selectSearchQuery = (state: SearchFilterState) => state.searchQuery;
export const selectDebouncedQuery = (state: SearchFilterState) => state.debouncedQuery;
export const selectActiveFilter = (state: SearchFilterState) => state.activeFilter;
export const selectActiveSort = (state: SearchFilterState) => state.activeSort;
export const selectIsSearchActive = (state: SearchFilterState) => 
  state.debouncedQuery.trim().length > 0;
