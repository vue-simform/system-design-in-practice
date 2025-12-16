import { useSearchFilterStore, type FilterType, type SortType } from '../../store/searchFilterStore';

/**
 * FilterBar Component
 * 
 * Provides filter chips and sort dropdown for the news feed.
 * 
 * Features:
 * - Filter tabs: All, Following, Liked
 * - Sort dropdown: Newest, Popular, Trending
 * - Active state highlighting
 * - Smooth transitions
 * - Accessible keyboard navigation
 * 
 * System Design Concepts:
 * 1. **Persistent Filters**: Preferences saved to localStorage
 * 2. **URL State Management**: Can sync with URL params (future)
 * 3. **Optimistic UI**: Instant feedback on filter change
 */
export function FilterBar() {
  const { 
    activeFilter, 
    activeSort, 
    setActiveFilter, 
    setActiveSort 
  } = useSearchFilterStore();

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All Posts' },
    { value: 'following', label: 'Following' },
    { value: 'liked', label: 'Liked' },
  ];

  const sortOptions: { value: SortType; label: string }[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'trending', label: 'Trending' },
  ];

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sort = e.target.value as SortType;
    setActiveSort(sort);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        
        {/* Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => handleFilterChange(filter.value)}
              className={`
                px-4 py-2 rounded-full font-medium text-sm
                transition-all duration-200 
                flex items-center gap-2
                ${
                  activeFilter === filter.value
                    ? 'bg-blue-500 text-white shadow-md scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
              aria-pressed={activeFilter === filter.value}
              aria-label={`Filter by ${filter.label}`}
            >
              <span>{filter.label}</span>
              {activeFilter === filter.value && (
                <span className="ml-1 text-xs">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label 
            htmlFor="sort-select" 
            className="text-sm font-medium text-gray-700 whitespace-nowrap"
          >
            Sort by:
          </label>
          <select
            id="sort-select"
            value={activeSort}
            onChange={handleSortChange}
            className="px-4 py-2 rounded-lg border border-gray-300 
                     bg-white text-gray-700 font-medium text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 
                     focus:border-transparent cursor-pointer
                     transition-all duration-200"
            aria-label="Sort posts"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filter Summary */}
      <div className="mt-3 text-sm text-gray-500 text-center">
        Showing{' '}
        <span className="font-semibold text-gray-700">
          {filters.find(f => f.value === activeFilter)?.label.toLowerCase()}
        </span>
        {' '}sorted by{' '}
        <span className="font-semibold text-gray-700">
          {sortOptions.find(s => s.value === activeSort)?.label.toLowerCase()}
        </span>
      </div>
    </div>
  );
}
