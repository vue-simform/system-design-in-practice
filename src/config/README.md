# Configuration Files

This directory contains all application configuration files.

## Files Overview

### `queryClient.ts`
React Query client configuration with optimized settings:
- **Stale Time**: 5 minutes (data considered fresh for this duration)
- **GC Time**: 30 minutes (unused data kept in cache)
- **Retry Logic**: Exponential backoff (3 retries: 1s, 2s, 4s)
- **Refetch Settings**: Disabled by default for performance

### `constants.ts`
Application-wide constants:
- API configuration (base URL, timeout)
- Pagination settings (page size, scroll threshold)
- Performance settings (image quality, lazy load offset)
- Cache settings (duration, database names)
- WebSocket configuration
- Mock user ID for POC

## Usage Examples

### Importing Query Client
```typescript
import { queryClient } from '@/config/queryClient';

// Use in your app
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

### Using Constants
```typescript
import { API_CONFIG, PAGINATION, CURRENT_USER_ID } from '@/config/constants';

// API call
const response = await fetch(`${API_CONFIG.BASE_URL}/feed`);

// Pagination
const limit = PAGINATION.DEFAULT_LIMIT;

// Current user (for POC)
const userId = CURRENT_USER_ID;
```

## Environment Variables

The application uses Vite's environment variables (prefixed with `VITE_`):

```bash
# .env file
VITE_API_BASE_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```
