/**
 * Authentication Context
 * 
 * Provides user authentication state throughout the application.
 * Replaces hardcoded CURRENT_USER_ID with proper context-based auth.
 * 
 * System Design Concepts:
 * - Centralized Auth State: Single source of truth for user data
 * - Context API: Avoid prop drilling
 * - Type Safety: TypeScript for auth state
 * - Extensible: Easy to add real auth later (Firebase, Auth0, etc.)
 * 
 * Usage:
 * ```tsx
 * const { currentUser, isAuthenticated } = useAuth();
 * ```
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { User } from '../types';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AuthContextType {
  currentUser: User | null;
  currentUserId: string | null;
  isAuthenticated: boolean;
  login?: (user: User) => void;
  logout?: () => void;
}

// ============================================================================
// Context Creation
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Mock User (for POC)
// ============================================================================

// TODO: Replace with real authentication
const MOCK_USER: User = {
  id: 'user-1',
  username: 'you',
  name: 'You',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
  bio: 'Demo user for POC',
};

// ============================================================================
// Auth Provider
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // For POC, we use a mock user
  // In production, this would:
  // 1. Check localStorage/cookies for existing session
  // 2. Validate token with backend
  // 3. Provide login/logout functionality
  // 4. Handle token refresh
  
  const contextValue: AuthContextType = {
    currentUser: MOCK_USER,
    currentUserId: MOCK_USER.id,
    isAuthenticated: true,
    
    // Placeholder methods for future implementation
    login: (user: User) => {
      console.log('Login functionality not implemented yet', user);
      // TODO: Implement login logic
      // - Call auth API
      // - Store token
      // - Update user state
    },
    
    logout: () => {
      console.log('Logout functionality not implemented yet');
      // TODO: Implement logout logic
      // - Clear token
      // - Clear user state
      // - Redirect to login
    },
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Custom Hook
// ============================================================================

/**
 * Hook to access auth context
 * 
 * @throws Error if used outside AuthProvider
 * @returns AuthContextType with current user and auth methods
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook to get current user ID
 * 
 * Convenience hook that returns just the user ID.
 * Use this to replace CURRENT_USER_ID imports.
 */
export function useCurrentUserId(): string {
  const { currentUserId } = useAuth();
  
  if (!currentUserId) {
    throw new Error('No authenticated user');
  }
  
  return currentUserId;
}

/**
 * Hook to get current user
 * 
 * Convenience hook that returns the full user object.
 */
export function useCurrentUser(): User {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    throw new Error('No authenticated user');
  }
  
  return currentUser;
}
