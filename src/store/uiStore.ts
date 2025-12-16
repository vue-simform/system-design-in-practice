import { create } from 'zustand';

/**
 * UI Store using Zustand
 * Manages client-side UI state (modals, themes, selections, etc.)
 */
interface UIState {
  selectedPostId: string | null;
  isCommentModalOpen: boolean;
  theme: 'light' | 'dark';
  // Profile state
  viewedUserId: string | null;
  isProfileLoading: boolean;
  
  // Analytics state
  selectedAnalyticsPeriod: '7d' | '30d' | '90d';
  isExportingAnalytics: boolean;
  
  setSelectedPost: (id: string | null) => void;
  openCommentModal: () => void;
  closeCommentModal: () => void;
  toggleTheme: () => void;
  // Profile actions
  setViewedUser: (userId: string | null) => void;
  setProfileLoading: (loading: boolean) => void;
  // Analytics actions
  setAnalyticsPeriod: (period: '7d' | '30d' | '90d') => void;
  setExportingAnalytics: (isExporting: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedPostId: null,
  isCommentModalOpen: false,
  theme: 'light',
  viewedUserId: null,
  isProfileLoading: false,
  
  // Analytics state
  selectedAnalyticsPeriod: '7d',
  isExportingAnalytics: false,
  
  setSelectedPost: (id) => set({ selectedPostId: id }),
  
  openCommentModal: () => set({ isCommentModalOpen: true }),
  
  closeCommentModal: () => set({ isCommentModalOpen: false }),
  
  toggleTheme: () => set((state) => ({ 
    theme: state.theme === 'light' ? 'dark' : 'light' 
  })),
  
  setViewedUser: (userId) => set({ viewedUserId: userId }),
  
  setProfileLoading: (loading) => set({ isProfileLoading: loading }),
  
  // Analytics actions
  setAnalyticsPeriod: (period) => set({ selectedAnalyticsPeriod: period }),
  
  setExportingAnalytics: (isExporting) => set({ isExportingAnalytics: isExporting }),
}));
