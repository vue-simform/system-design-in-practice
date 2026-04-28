# System Design Enhancements Roadmap

> **Advanced features and improvements to take this news feed from good to production-grade enterprise**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Enhancements (Week 1)](#critical-enhancements)
3. [Important Features (Month 1)](#important-features)
4. [Advanced Capabilities (Quarter 1)](#advanced-capabilities)
5. [Implementation Guides](#implementation-guides)
6. [Performance Improvements](#performance-improvements)
7. [Developer Experience](#developer-experience)
8. [Missing System Design Patterns](#missing-patterns)

---

## Executive Summary {#executive-summary}

### Current State: **Excellent Foundation** ✅

**Strengths:**
- ✅ Multi-layer caching (Memory → IndexedDB → Service Worker)
- ✅ Offline-first architecture with queue system
- ✅ Optimistic UI with rollback
- ✅ Cursor pagination (scalable to billions)
- ✅ Error classification and retry logic
- ✅ Circuit breaker pattern
- ✅ WCAG 2.1 AA accessibility
- ✅ PWA with offline support
- ✅ TypeScript throughout (100% coverage)
- ✅ Testing setup (Vitest + Testing Library)

### Missing Enterprise Features: **10 Critical Gaps** ❌

1. **Real-time capabilities** (WebSocket/SSE) - Most critical
2. **Authentication system** (JWT, OAuth, session management)
3. **Production monitoring** (Sentry, logging, metrics)
4. **Advanced search** (Elasticsearch, fuzzy matching)
5. **Container infrastructure** (Docker, Kubernetes)
6. **GraphQL API** (alternative to REST)
7. **AI/ML features** (recommendations, moderation)
8. **Rate limiting** (client + server)
9. **Image CDN** (optimization, delivery)
10. **End-to-end testing** (Playwright/Cypress)

### Impact of Enhancements

| Enhancement | Value Add | Complexity | Priority |
|-------------|-----------|------------|----------|
| Real-time updates | High (modern UX expectation) | Medium | 🔴 Critical |
| Authentication | High (security fundamental) | Medium | 🔴 Critical |
| Monitoring | High (production readiness) | Low | 🔴 Critical |
| Search upgrade | Medium (UX improvement) | High | 🟡 Important |
| GraphQL | Medium (API evolution) | High | 🟢 Nice to have |
| AI/ML | Low (differentiation) | Very High | 🟢 Nice to have |

---

## Critical Enhancements (Week 1) {#critical-enhancements}

### 1. Real-Time Updates with WebSocket

**Problem:** Feed is static. Users must refresh to see new posts.

**Solution:** WebSocket connection for live updates.

**Files to Create:**

#### `src/services/websocket.ts`
```typescript
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(userId: string) {
    this.socket = io(import.meta.env.VITE_WS_URL || 'ws://localhost:3001', {
      auth: { userId },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error);
      this.reconnectAttempts++;
    });

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
  }

  // Subscribe to events
  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string) {
    this.socket?.off(event);
  }

  // Emit events
  emit(event: string, data: any) {
    this.socket?.emit(event, data);
  }
}

export const wsService = new WebSocketService();
```

#### `src/hooks/useWebSocket.ts`
```typescript
import { useEffect, useState } from 'react';
import { wsService } from '@/services/websocket';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './useToast';

export function useWebSocket() {
  const { currentUserId } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);

  useEffect(() => {
    if (!currentUserId) return;

    // Connect
    const socket = wsService.connect(currentUserId);

    // Listen for connection status
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Listen for new posts
    socket.on('new-post', (post: Post) => {
      // Don't show notification if user created it
      if (post.authorId === currentUserId) return;

      // Increment counter
      setNewPostsCount(prev => prev + 1);

      // Show toast
      addToast({
        type: 'info',
        title: 'New Post',
        message: `${post.author.name} posted`,
        duration: 3000,
      });
    });

    // Listen for post updates (likes, comments)
    socket.on('post-updated', ({ postId, updates }) => {
      // Update React Query cache
      queryClient.setQueryData(['post', postId], (old: Post | undefined) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      // Invalidate feed to refetch
      queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
    });

    // Listen for new comments
    socket.on('new-comment', ({ postId, comment }) => {
      // Update comments cache
      queryClient.setQueryData(['comments', postId], (old: Comment[] | undefined) => {
        return [...(old || []), comment];
      });

      // Update post comment count
      queryClient.setQueryData(['post', postId], (old: Post | undefined) => {
        if (!old) return old;
        return { ...old, commentCount: old.commentCount + 1 };
      });
    });

    // Cleanup
    return () => {
      wsService.disconnect();
    };
  }, [currentUserId, queryClient, addToast]);

  // Load new posts
  const loadNewPosts = () => {
    queryClient.invalidateQueries({ queryKey: ['feed', 'infinite'] });
    setNewPostsCount(0);
  };

  return {
    isConnected,
    newPostsCount,
    loadNewPosts,
  };
}
```

#### `src/components/feed/NewPostsIndicator.tsx`
```typescript
// Already exists at src/components/feed/NewPostsIndicator.tsx
// Enhance with real WebSocket data:

import { useWebSocket } from '@/hooks/useWebSocket';

export function NewPostsIndicator() {
  const { newPostsCount, loadNewPosts, isConnected } = useWebSocket();

  if (!isConnected || newPostsCount === 0) return null;

  return (
    <button
      onClick={loadNewPosts}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50
                 bg-blue-500 text-white px-6 py-3 rounded-full
                 shadow-lg hover:bg-blue-600 transition-all
                 animate-bounce"
    >
      {newPostsCount} new post{newPostsCount > 1 ? 's' : ''} available
    </button>
  );
}
```

#### Backend: `server/websocket.js`
```javascript
const { Server } = require('socket.io');

function setupWebSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  // Connected users
  const users = new Map();

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth.userId;
    console.log(`[WS] User ${userId} connected`);

    // Store user socket
    users.set(userId, socket.id);

    // Join user's room
    socket.join(`user:${userId}`);

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[WS] User ${userId} disconnected`);
      users.delete(userId);
    });

    // Typing indicator
    socket.on('typing', ({ postId }) => {
      socket.to(`post:${postId}`).emit('user-typing', { userId });
    });
  });

  return {
    // Emit new post to all users
    emitNewPost: (post) => {
      io.emit('new-post', post);
    },

    // Emit post update to all users
    emitPostUpdate: (postId, updates) => {
      io.emit('post-updated', { postId, updates });
    },

    // Emit new comment
    emitNewComment: (postId, comment) => {
      io.emit('new-comment', { postId, comment });
    },

    // Emit to specific user
    emitToUser: (userId, event, data) => {
      const socketId = users.get(userId);
      if (socketId) {
        io.to(socketId).emit(event, data);
      }
    },
  };
}

module.exports = { setupWebSocket };
```

#### Update `server/server.js`
```javascript
const http = require('http');
const { setupWebSocket } = require('./websocket');

// Create HTTP server
const httpServer = http.createServer(app);

// Setup WebSocket
const ws = setupWebSocket(httpServer);

// Emit events on mutations
app.post('/api/posts', (req, res) => {
  // ... create post logic
  const newPost = { /* ... */ };

  // Emit to all users
  ws.emitNewPost(newPost);

  res.json(newPost);
});

app.post('/api/posts/:postId/like', (req, res) => {
  // ... like logic
  ws.emitPostUpdate(postId, { likeCount: newLikeCount });
  res.json({ success: true });
});

// Start server
httpServer.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('WebSocket server ready');
});
```

**Benefits:**
- ✅ Real-time feed updates
- ✅ Live like/comment counts
- ✅ User presence indicators
- ✅ Typing indicators
- ✅ Modern UX (like Twitter, Instagram)

---

### 2. Authentication System

**Problem:** Mock user hardcoded everywhere. No real auth.

**Solution:** JWT-based authentication with refresh tokens.

**Files to Create:**

#### `src/contexts/AuthContext.tsx` (enhance existing)
```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '@/services/auth';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize: Check for stored token
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }

    setIsLoading(false);
  }, []);

  // Auto-refresh token every 14 minutes (token expires in 15)
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      refreshToken();
    }, 14 * 60 * 1000);

    return () => clearInterval(interval);
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });

    setToken(response.token);
    setUser(response.user);

    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('auth_user', JSON.stringify(response.user));
    localStorage.setItem('refresh_token', response.refreshToken);
  };

  const signup = async (email: string, password: string, name: string) => {
    const response = await authApi.signup({ email, password, name });

    setToken(response.token);
    setUser(response.user);

    localStorage.setItem('auth_token', response.token);
    localStorage.setItem('auth_user', JSON.stringify(response.user));
    localStorage.setItem('refresh_token', response.refreshToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);

    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('refresh_token');

    // Clear React Query cache
    queryClient.clear();
  };

  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');

      const response = await authApi.refresh(refreshToken);

      setToken(response.token);
      localStorage.setItem('auth_token', response.token);
    } catch (error) {
      // Refresh failed: Logout
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

#### `src/services/auth.ts`
```typescript
import apiClient from './api';

export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const response = await apiClient.post('/api/auth/login', credentials);
    return response.data;
  },

  signup: async (data: { email: string; password: string; name: string }) => {
    const response = await apiClient.post('/api/auth/signup', data);
    return response.data;
  },

  refresh: async (refreshToken: string) => {
    const response = await apiClient.post('/api/auth/refresh', { refreshToken });
    return response.data;
  },

  logout: async () => {
    await apiClient.post('/api/auth/logout');
  },

  verify: async (token: string) => {
    const response = await apiClient.get('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },
};
```

#### Backend: `server/auth.js`
```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret';

// Generate tokens
function generateTokens(user) {
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { token, refreshToken };
}

// Middleware: Verify JWT
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Routes
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;

  // Validate
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if user exists
  const existingUser = db.get('users').find({ email }).value();
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const newUser = {
    id: `u${Date.now()}`,
    email,
    name,
    password: hashedPassword,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
    createdAt: new Date().toISOString(),
  };

  db.get('users').push(newUser).write();

  // Generate tokens
  const { token, refreshToken } = generateTokens(newUser);

  // Don't send password
  const { password: _, ...userWithoutPassword } = newUser;

  res.status(201).json({
    user: userWithoutPassword,
    token,
    refreshToken,
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = db.get('users').find({ email }).value();

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const { token, refreshToken } = generateTokens(user);

  const { password: _, ...userWithoutPassword } = user;

  res.json({
    user: userWithoutPassword,
    token,
    refreshToken,
  });
});

app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);

    const user = db.get('users').find({ id: decoded.userId }).value();
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { token: newToken } = generateTokens(user);

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Protected routes
app.use('/api/posts', authenticate);
app.use('/api/comments', authenticate);
// etc.

module.exports = { authenticate };
```

**Benefits:**
- ✅ Secure authentication
- ✅ Token refresh (seamless UX)
- ✅ Protected routes
- ✅ Password hashing (bcrypt)
- ✅ JWT standard

---

### 3. Production Monitoring with Sentry

**Problem:** No error tracking. Bugs go unnoticed.

**Solution:** Sentry for error monitoring + logging.

**Installation:**
```bash
npm install @sentry/react @sentry/vite-plugin
```

#### `src/services/monitoring.ts`
```typescript
import * as Sentry from '@sentry/react';
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

export function initMonitoring() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      integrations: [
        // Performance monitoring
        new Sentry.BrowserTracing({
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(
            React.useEffect,
            useLocation,
            useNavigationType,
            createRoutesFromChildren,
            matchRoutes
          ),
        }),
        // Session replay
        new Sentry.Replay({
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],

      // Performance Monitoring
      tracesSampleRate: 0.1, // 10% of transactions

      // Session Replay
      replaysSessionSampleRate: 0.1, // 10% of sessions
      replaysOnErrorSampleRate: 1.0, // 100% on errors

      // Release tracking
      release: import.meta.env.VITE_APP_VERSION,

      // Ignore known errors
      ignoreErrors: [
        'Network request failed',
        'ResizeObserver loop limit exceeded',
      ],

      // Custom error handler
      beforeSend(event, hint) {
        // Don't send errors in dev
        if (import.meta.env.DEV) return null;

        // Add user context
        const user = JSON.parse(localStorage.getItem('auth_user') || 'null');
        if (user) {
          event.user = {
            id: user.id,
            email: user.email,
            username: user.name,
          };
        }

        return event;
      },
    });
  }
}

// Track custom events
export function trackEvent(name: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    category: 'user-action',
    message: name,
    data,
    level: 'info',
  });
}

// Track performance
export function trackPerformance(metric: string, value: number) {
  Sentry.setMeasurement(metric, value, 'millisecond');
}
```

#### Update `src/main.tsx`
```typescript
import { initMonitoring } from './services/monitoring';

// Initialize monitoring first
initMonitoring();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
```

#### `vite.config.ts` enhancement
```typescript
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    // Upload source maps to Sentry
    sentryVitePlugin({
      org: 'your-org',
      project: 'news-feed',
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],

  build: {
    sourcemap: true, // Generate source maps
  },
});
```

**Benefits:**
- ✅ Error tracking in production
- ✅ Performance monitoring
- ✅ Session replay (see what user did before error)
- ✅ Release tracking
- ✅ User context on errors
- ✅ Source maps for debugging

---

### 4. Docker Setup

**Problem:** "Works on my machine" syndrome.

**Solution:** Docker containers for consistency.

#### `Dockerfile`
```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### `docker-compose.yml`
```yaml
version: '3.8'

services:
  # Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      - VITE_API_BASE_URL=http://backend:3001
    depends_on:
      - backend
    networks:
      - app-network

  # Backend
  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=${DATABASE_URL}
    volumes:
      - ./server/db:/app/db
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis for caching
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network

  # PostgreSQL (replace JSON Server)
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=newsfeed
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  redis-data:
  postgres-data:
```

#### `.dockerignore`
```
node_modules
dist
.git
.env
*.log
coverage
.vscode
```

**Run with:**
```bash
docker-compose up --build
```

**Benefits:**
- ✅ Consistent environment
- ✅ Easy deployment
- ✅ Scalable (add replicas)
- ✅ Isolated services
- ✅ Production-ready

---

### 5. CI/CD Pipeline Enhancement

**Problem:** Manual deployment, no automated tests.

**Solution:** GitHub Actions with tests, linting, security checks.

#### `.github/workflows/ci-cd.yml`
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # Job 1: Test
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  # Job 2: Lint & Type Check
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript check
        run: npm run type-check

  # Job 3: Security Scan
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run npm audit
        run: npm audit --audit-level=high

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  # Job 4: Build
  build:
    runs-on: ubuntu-latest
    needs: [test, lint, security]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Check bundle size
        run: |
          SIZE=$(du -sb dist | cut -f1)
          MAX_SIZE=524288000  # 500MB
          if [ $SIZE -gt $MAX_SIZE ]; then
            echo "Bundle too large: $SIZE bytes (max: $MAX_SIZE)"
            exit 1
          fi

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist
          path: dist/

  # Job 5: Lighthouse CI
  lighthouse:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Download build
        uses: actions/download-artifact@v3
        with:
          name: dist
          path: dist/

      - name: Run Lighthouse CI
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            http://localhost:3000
          uploadArtifacts: true
          temporaryPublicStorage: true

  # Job 6: Deploy (only on main branch)
  deploy:
    runs-on: ubuntu-latest
    needs: [build, lighthouse]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Download build
        uses: actions/download-artifact@v3
        with:
          name: dist
          path: dist/

      - name: Deploy to production
        run: |
          # Deploy to your hosting provider
          # Example: Vercel, Netlify, AWS S3, etc.
          echo "Deploying to production..."

      - name: Notify Sentry of release
        uses: getsentry/action-release@v1
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
        with:
          environment: production
```

**Benefits:**
- ✅ Automated testing
- ✅ Security scanning
- ✅ Bundle size checks
- ✅ Performance audits (Lighthouse)
- ✅ Automated deployment
- ✅ Release tracking

---

**End of Critical Enhancements**

**Continue to next file for Important Features (Month 1)...**
