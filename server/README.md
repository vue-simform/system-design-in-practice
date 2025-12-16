# Mock Backend Server for News Feed POC

A simple JSON Server setup that provides a complete REST API for your News Feed application.

## Features

- RESTful API endpoints for feed, posts, users, comments, and likes
- Cursor-based pagination for infinite scroll
- Real-time-like operations (like, comment, share)
- CORS enabled for frontend integration
- Simulated network delay for realistic testing
- Pre-populated with sample data

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will start at `http://localhost:3001`

### 3. For Development (with auto-reload)

```bash
npm run dev
```

## API Endpoints

### Feed

**Get Paginated Feed**
```http
GET /api/feed?limit=10&cursor=eyJsYXN0SWQiOiJwMSJ9
```

Response:
```json
{
  "posts": [
    {
      "id": "p1",
      "content": "Post content...",
      "author": {
        "id": "u1",
        "username": "john_doe",
        "name": "John Doe",
        "avatar": "https://..."
      },
      "likeCount": 142,
      "commentCount": 23,
      "shareCount": 8,
      "createdAt": "2024-12-02T10:30:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJsYXN0SWQiOiJwMTAifQ==",
    "hasMore": true
  }
}
```

### Posts

**Create Post**
```http
POST /api/posts
Content-Type: application/json

{
  "content": "My new post!",
  "mediaUrls": ["https://..."],
  "authorId": "u1"
}
```

**Like Post**
```http
POST /api/posts/:postId/like
Content-Type: application/json

{
  "userId": "u1"
}
```

**Unlike Post**
```http
DELETE /api/posts/:postId/like?userId=u1
```

**Get Comments**
```http
GET /api/posts/:postId/comments
```

**Add Comment**
```http
POST /api/posts/:postId/comments
Content-Type: application/json

{
  "text": "Great post!",
  "userId": "u1",
  "parentId": null
}
```

### Users

**Get All Users**
```http
GET /api/users
```

**Get User by ID**
```http
GET /api/users/:userId
```

## Database Structure

The `db.json` file contains:

- **users**: User profiles with avatar, bio, followers count
- **posts**: Posts with content, media, engagement metrics
- **comments**: Comments with threading support (parentId)
- **likes**: Like relationships between users and posts
- **follows**: Follow relationships between users

## Features Implemented

### 1. Cursor-Based Pagination
- Supports infinite scroll
- Avoids duplicate/missing items
- Better performance than offset-based

### 2. Optimistic Updates
- Instant feedback for likes
- Comment count updates automatically
- Server validates and corrects if needed

### 3. Normalized Data
- Separate tables for users, posts, comments
- Reduced duplication
- Easy to maintain

### 4. Rich Responses
- Posts include author information
- Comments include author details
- Ready for frontend consumption

## Sample Data

The server comes with:
- 4 sample users
- 8 sample posts with images
- Comments with threading
- Like and follow relationships

## Testing the API

### Using cURL

```bash
# Get feed
curl http://localhost:3001/api/feed?limit=5

# Create post
curl -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello World!","authorId":"u1"}'

# Like a post
curl -X POST http://localhost:3001/api/posts/p1/like \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1"}'

# Add comment
curl -X POST http://localhost:3001/api/posts/p1/comments \
  -H "Content-Type: application/json" \
  -d '{"text":"Nice post!","userId":"u1"}'
```

### Using Fetch (JavaScript)

```javascript
// Get feed
const response = await fetch('http://localhost:3001/api/feed?limit=10');
const data = await response.json();

// Create post
const newPost = await fetch('http://localhost:3001/api/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'My new post!',
    authorId: 'u1'
  })
});

// Like post
await fetch('http://localhost:3001/api/posts/p1/like', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'u1' })
});
```

## Configuration

### Change Port

Edit `server.js` or set environment variable:
```bash
PORT=4000 npm start
```

### Adjust Network Delay

Edit `server.js`:
```javascript
server.use((req, res, next) => {
  setTimeout(next, 500); // Change delay here (ms)
});
```

### Disable Delay

Comment out the delay middleware in `server.js`:
```javascript
// server.use((req, res, next) => {
//   setTimeout(next, 500);
// });
```

## Integration with Frontend

### API Service (TypeScript)

```typescript
// src/services/api.ts
const API_URL = 'http://localhost:3001/api';

export const feedApi = {
  async getFeed(cursor?: string, limit = 10) {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    params.append('limit', limit.toString());
    
    const response = await fetch(`${API_URL}/feed?${params}`);
    return response.json();
  },
  
  async likePost(postId: string, userId: string) {
    const response = await fetch(`${API_URL}/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    return response.json();
  },
  
  async createPost(content: string, authorId: string, mediaUrls?: string[]) {
    const response = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, authorId, mediaUrls })
    });
    return response.json();
  }
};
```

### React Query Integration

```typescript
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';

export function useFeed() {
  return useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => feedApi.getFeed(pageParam),
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor,
  });
}

export function useLikePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ postId, userId }: { postId: string; userId: string }) =>
      feedApi.likePost(postId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['feed']);
    }
  });
}
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3001
kill -9 $(lsof -ti:3001)

# Or use different port
PORT=3002 npm start
```

### CORS Issues
The server has CORS enabled by default. If you still face issues, check the middleware in `server.js`.

### Data Reset
To reset the database to initial state, restore `db.json` from backup or re-run the seed script.

## Production Considerations

This is a **mock server for development only**. For production:

1. Use a real database (PostgreSQL, MongoDB)
2. Implement authentication (JWT, OAuth)
3. Add validation and sanitization
4. Implement rate limiting
5. Add proper error handling
6. Use environment variables
7. Deploy to a cloud service

## Resources

- [JSON Server Documentation](https://github.com/typicode/json-server)
- [REST API Best Practices](https://restfulapi.net/)
- [Cursor-based Pagination](https://slack.engineering/evolving-api-pagination-at-slack/)

## Support

For issues or questions, refer to the main POC documentation.
