const jsonServer = require('json-server');
const path = require('path');
const server = jsonServer.create();

// Use path.join to resolve db.json relative to this script's directory
const dbPath = path.join(__dirname, 'db.json');
const router = jsonServer.router(dbPath);
const middlewares = jsonServer.defaults();

// Custom middleware for CORS
server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Add delay to simulate network latency (optional)
server.use((req, res, next) => {
  setTimeout(next, 500); // 500ms delay
});

// Use default middleware
server.use(middlewares);

// Custom routes
server.use(jsonServer.bodyParser);

// GET /api/feed - Get paginated feed with filter and sort support
server.get('/api/feed', (req, res) => {
  const db = router.db;
  const limit = parseInt(req.query.limit) || 10;
  const cursor = req.query.cursor || null;
  const filter = req.query.filter || 'all';
  const sort = req.query.sort || 'newest';
  
  let posts = db.get('posts').value() || [];
  const users = db.get('users').value() || [];
  const likes = db.get('likes').value() || [];
  
  // Apply filter type (all/following/liked)
  // Note: For demo purposes, following/liked use simulated logic
  if (filter === 'liked') {
    // Show posts liked by user u1 (demo user)
    const likedPostIds = likes.filter(l => l.userId === 'u1').map(l => l.postId);
    posts = posts.filter(p => likedPostIds.includes(p.id));
  } else if (filter === 'following') {
    // For demo, show posts from users u2, u3, u4 (simulating "following")
    posts = posts.filter(p => ['u2', 'u3', 'u4'].includes(p.authorId));
  }
  // 'all' filter - no additional filtering needed
  
  // Apply sorting
  if (sort === 'newest') {
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === 'popular') {
    // Sort by like count descending
    posts.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  } else if (sort === 'trending') {
    // Trending = combination of recent + popular
    // Score = likeCount * 2 + commentCount - (age_in_hours / 24)
    posts.sort((a, b) => {
      const scoreA = (a.likeCount * 2) + a.commentCount - 
        ((Date.now() - new Date(a.createdAt)) / (1000 * 60 * 60 * 24));
      const scoreB = (b.likeCount * 2) + b.commentCount - 
        ((Date.now() - new Date(b.createdAt)) / (1000 * 60 * 60 * 24));
      return scoreB - scoreA;
    });
  }
  
  // Apply cursor pagination
  let startIndex = 0;
  if (cursor) {
    try {
      const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
      startIndex = posts.findIndex(p => p.id === decodedCursor.lastId) + 1;
    } catch (e) {
      startIndex = 0;
    }
  }
  
  const paginatedPosts = posts.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < posts.length;
  
  // Generate next cursor
  let nextCursor = null;
  if (hasMore && paginatedPosts.length > 0) {
    const lastPost = paginatedPosts[paginatedPosts.length - 1];
    nextCursor = Buffer.from(JSON.stringify({ 
      lastId: lastPost.id,
      timestamp: lastPost.createdAt 
    })).toString('base64');
  }
  
  // Enrich posts with user data
  const enrichedPosts = paginatedPosts.map(post => {
    const author = users.find(u => u.id === post.authorId);
    return {
      ...post,
      author: author ? {
        id: author.id,
        username: author.username,
        name: author.name,
        avatar: author.avatar
      } : null
    };
  });
  
  console.log(`📰 Feed: filter=${filter}, sort=${sort}, results=${enrichedPosts.length}/${posts.length}`);
  
  res.json({
    posts: enrichedPosts,
    pagination: {
      nextCursor,
      hasMore
    }
  });
});

// POST /api/posts/:postId/like - Like a post
server.post('/api/posts/:postId/like', (req, res) => {
  const db = router.db;
  const postId = req.params.postId;
  const userId = req.body.userId || 'u1'; // Default user for demo
  
  const post = db.get('posts').find({ id: postId }).value();
  
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  
  // Check if already liked
  const existingLike = db.get('likes').find({ postId, userId }).value();
  
  if (existingLike) {
    return res.status(400).json({ error: 'Already liked' });
  }
  
  // Add like
  const newLike = {
    id: `l${Date.now()}`,
    postId,
    userId,
    createdAt: new Date().toISOString()
  };
  
  db.get('likes').push(newLike).write();
  
  // Increment like count
  db.get('posts')
    .find({ id: postId })
    .assign({ likeCount: post.likeCount + 1 })
    .write();
  
  res.json({ success: true, likeCount: post.likeCount + 1 });
});

// DELETE /api/posts/:postId/like - Unlike a post
server.delete('/api/posts/:postId/like', (req, res) => {
  const db = router.db;
  const postId = req.params.postId;
  const userId = req.query.userId || 'u1';
  
  const post = db.get('posts').find({ id: postId }).value();
  
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  
  // Remove like
  db.get('likes').remove({ postId, userId }).write();
  
  // Decrement like count
  const newCount = Math.max(0, post.likeCount - 1);
  db.get('posts')
    .find({ id: postId })
    .assign({ likeCount: newCount })
    .write();
  
  res.json({ success: true, likeCount: newCount });
});

// POST /api/posts/:postId/comments - Add a comment
server.post('/api/posts/:postId/comments', (req, res) => {
  const db = router.db;
  const postId = req.params.postId;
  const { text, userId, parentId } = req.body;
  
  const post = db.get('posts').find({ id: postId }).value();
  
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  
  const newComment = {
    id: `c${Date.now()}`,
    postId,
    authorId: userId || 'u1',
    text,
    parentId: parentId || null,
    createdAt: new Date().toISOString()
  };
  
  db.get('comments').push(newComment).write();
  
  // Increment comment count
  db.get('posts')
    .find({ id: postId })
    .assign({ commentCount: post.commentCount + 1 })
    .write();
  
  // Get author info
  const author = db.get('users').find({ id: newComment.authorId }).value();
  
  res.json({
    ...newComment,
    author: author ? {
      id: author.id,
      username: author.username,
      name: author.name,
      avatar: author.avatar
    } : null
  });
});

// GET /api/posts/:postId/comments - Get comments for a post
server.get('/api/posts/:postId/comments', (req, res) => {
  const db = router.db;
  const postId = req.params.postId;
  
  const comments = db.get('comments').filter({ postId }).value();
  const users = db.get('users').value();
  
  const enrichedComments = comments.map(comment => {
    const author = users.find(u => u.id === comment.authorId);
    return {
      ...comment,
      author: author ? {
        id: author.id,
        username: author.username,
        name: author.name,
        avatar: author.avatar
      } : null
    };
  });
  
  res.json(enrichedComments);
});

// POST /api/posts - Create a new post
server.post('/api/posts', (req, res) => {
  const db = router.db;
  const { content, mediaUrls, authorId } = req.body;
  
  const newPost = {
    id: `p${Date.now()}`,
    authorId: authorId || 'u1',
    content,
    mediaUrls: mediaUrls || [],
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.get('posts').push(newPost).write();
  
  // Get author info
  const author = db.get('users').find({ id: newPost.authorId }).value();
  
  res.status(201).json({
    ...newPost,
    author: author ? {
      id: author.id,
      username: author.username,
      name: author.name,
      avatar: author.avatar
    } : null
  });
});

// GET /api/search - Search posts with filters and sorting
server.get('/api/search', (req, res) => {
  const db = router.db;
  const query = req.query.q || '';
  const filter = req.query.filter || 'all';
  const sort = req.query.sort || 'newest';
  const limit = parseInt(req.query.limit) || 20;
  const cursor = req.query.cursor || null;
  
  let posts = db.get('posts').value() || [];
  const users = db.get('users').value() || [];
  const likes = db.get('likes').value() || [];
  
  // Filter by search query (case-insensitive search in content and author)
  if (query.trim()) {
    const lowerQuery = query.toLowerCase();
    posts = posts.filter(post => {
      const author = users.find(u => u.id === post.authorId);
      const contentMatch = post.content.toLowerCase().includes(lowerQuery);
      const authorMatch = author && (
        author.name.toLowerCase().includes(lowerQuery) ||
        author.username.toLowerCase().includes(lowerQuery)
      );
      return contentMatch || authorMatch;
    });
  }
  
  // Apply filter type (all/following/liked)
  // Note: For demo purposes, following/liked use simulated logic
  if (filter === 'liked') {
    // Show posts liked by user u1 (demo user)
    const likedPostIds = likes.filter(l => l.userId === 'u1').map(l => l.postId);
    posts = posts.filter(p => likedPostIds.includes(p.id));
  } else if (filter === 'following') {
    // For demo, show posts from users u2, u3, u4 (simulating "following")
    posts = posts.filter(p => ['u2', 'u3', 'u4'].includes(p.authorId));
  }
  // 'all' filter - no additional filtering needed
  
  // Apply sorting
  if (sort === 'newest') {
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === 'popular') {
    // Sort by like count descending
    posts.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
  } else if (sort === 'trending') {
    // Trending = combination of recent + popular
    // Score = likeCount * 2 + commentCount - (age_in_hours / 24)
    posts.sort((a, b) => {
      const scoreA = (a.likeCount * 2) + a.commentCount - 
        ((Date.now() - new Date(a.createdAt)) / (1000 * 60 * 60 * 24));
      const scoreB = (b.likeCount * 2) + b.commentCount - 
        ((Date.now() - new Date(b.createdAt)) / (1000 * 60 * 60 * 24));
      return scoreB - scoreA;
    });
  }
  
  // Apply cursor pagination
  let startIndex = 0;
  if (cursor) {
    try {
      const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
      startIndex = posts.findIndex(p => p.id === decodedCursor.lastId) + 1;
    } catch (e) {
      startIndex = 0;
    }
  }
  
  const paginatedPosts = posts.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < posts.length;
  
  // Generate next cursor
  let nextCursor = null;
  if (hasMore && paginatedPosts.length > 0) {
    const lastPost = paginatedPosts[paginatedPosts.length - 1];
    nextCursor = Buffer.from(JSON.stringify({ 
      lastId: lastPost.id,
      timestamp: lastPost.createdAt 
    })).toString('base64');
  }
  
  // Enrich posts with user data
  const enrichedPosts = paginatedPosts.map(post => {
    const author = users.find(u => u.id === post.authorId);
    return {
      ...post,
      author: author ? {
        id: author.id,
        username: author.username,
        name: author.name,
        avatar: author.avatar
      } : null
    };
  });
  
  console.log(`🔍 Search: query="${query}", filter=${filter}, sort=${sort}, results=${enrichedPosts.length}/${posts.length}`);
  
  res.json({
    posts: enrichedPosts,
    pagination: {
      nextCursor,
      hasMore
    }
  });
});

// GET /api/users/:userId - Get user profile
server.get('/api/users/:userId', (req, res) => {
  const db = router.db;
  const { userId } = req.params;
  
  const users = db.get('users').value() || [];
  const posts = db.get('posts').value() || [];
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Count user's posts
  const userPosts = posts.filter(p => p.authorId === userId);
  const postCount = userPosts.length;
  
  // For demo, use hardcoded follower/following counts
  // In production, these would come from a relationships table
  const followerCount = Math.floor(Math.random() * 1000) + 100;
  const followingCount = Math.floor(Math.random() * 500) + 50;
  
  // Check if current user is following (for demo, random)
  const isFollowing = Math.random() > 0.5;
  
  const profile = {
    ...user,
    bio: user.bio || `Hi, I'm ${user.name}! Welcome to my profile.`,
    followerCount,
    followingCount,
    postCount,
    isFollowing,
    joinedAt: user.joinedAt || '2024-01-01T00:00:00Z'
  };
  
  console.log(`👤 Profile: userId="${userId}", posts=${postCount}, followers=${followerCount}`);
  
  res.json({ user: profile });
});

// GET /api/users/:userId/posts - Get user's posts
server.get('/api/users/:userId/posts', (req, res) => {
  const db = router.db;
  const { userId } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  const cursor = req.query.cursor || null;
  
  let posts = db.get('posts').value() || [];
  const users = db.get('users').value() || [];
  
  // Filter posts by user
  posts = posts.filter(p => p.authorId === userId);
  
  // Sort by createdAt descending
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Apply cursor pagination
  let startIndex = 0;
  if (cursor) {
    try {
      const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
      startIndex = posts.findIndex(p => p.id === decodedCursor.lastId) + 1;
    } catch (e) {
      startIndex = 0;
    }
  }
  
  const paginatedPosts = posts.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < posts.length;
  
  // Generate next cursor
  let nextCursor = null;
  if (hasMore && paginatedPosts.length > 0) {
    const lastPost = paginatedPosts[paginatedPosts.length - 1];
    const cursorData = {
      lastId: lastPost.id,
      timestamp: lastPost.createdAt
    };
    nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }
  
  // Enrich with author data
  const enrichedPosts = paginatedPosts.map(post => {
    const author = users.find(u => u.id === post.authorId);
    return { ...post, author };
  });
  
  console.log(`📝 User Posts: userId="${userId}", found=${posts.length}, returned=${enrichedPosts.length}`);
  
  res.json({
    posts: enrichedPosts,
    pagination: {
      nextCursor,
      hasMore
    }
  });
});

// POST /api/users/:userId/follow - Follow/Unfollow user
server.post('/api/users/:userId/follow', (req, res) => {
  const db = router.db;
  const { userId } = req.params;
  const { action } = req.body; // 'follow' or 'unfollow'
  
  const users = db.get('users').value() || [];
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // For demo, simulate follow/unfollow
  // In production, this would update a relationships table
  const isFollowing = action === 'follow';
  const followerCount = Math.floor(Math.random() * 1000) + 100 + (isFollowing ? 1 : -1);
  
  console.log(`${isFollowing ? '➕' : '➖'} Follow: userId="${userId}", action="${action}"`);
  
  res.json({
    success: true,
    followerCount,
    isFollowing
  });
});

// GET /api/notifications - Get user notifications (paginated)
server.get('/api/notifications', (req, res) => {
  const db = router.db;
  const limit = parseInt(req.query.limit) || 20;
  const cursor = req.query.cursor || null;
  const filter = req.query.filter || 'all'; // 'all' or 'unread'
  
  // Get or initialize notifications
  let notifications = db.get('notifications').value() || [];
  
  // Initialize demo notifications if empty
  if (notifications.length === 0) {
    const users = db.get('users').value() || [];
    const posts = db.get('posts').value() || [];
    
    notifications = [
      {
        id: 'n1',
        type: 'like',
        priority: 'normal',
        actorId: 'u2',
        targetId: 'p1',
        targetType: 'post',
        message: 'liked your post',
        read: false,
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        metadata: { postContent: 'Just deployed a new feature! 🚀' }
      },
      {
        id: 'n2',
        type: 'comment',
        priority: 'high',
        actorId: 'u3',
        targetId: 'p1',
        targetType: 'post',
        message: 'commented on your post',
        read: false,
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        metadata: { postContent: 'Just deployed a new feature! 🚀', commentText: 'Great work!' }
      },
      {
        id: 'n3',
        type: 'follow',
        priority: 'normal',
        actorId: 'u4',
        targetId: 'u1',
        targetType: 'user',
        message: 'started following you',
        read: true,
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        metadata: {}
      },
      {
        id: 'n4',
        type: 'reply',
        priority: 'high',
        actorId: 'u2',
        targetId: 'c1',
        targetType: 'comment',
        message: 'replied to your comment',
        read: true,
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        metadata: { commentText: 'Thanks for the feedback!', postId: 'p1' }
      },
      {
        id: 'n5',
        type: 'mention',
        priority: 'high',
        actorId: 'u3',
        targetId: 'p2',
        targetType: 'post',
        message: 'mentioned you in a post',
        read: true,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        metadata: { postContent: '@john_doe check this out!' }
      },
      {
        id: 'n6',
        type: 'like',
        priority: 'low',
        actorId: 'u4',
        targetId: 'p3',
        targetType: 'post',
        message: 'liked your post',
        read: true,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        metadata: { postContent: 'Working on something exciting...' }
      }
    ];
    
    // Save to db.json
    db.set('notifications', notifications).write();
  }
  
  // Sort by createdAt descending
  notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Apply filter
  if (filter === 'unread') {
    notifications = notifications.filter(n => !n.read);
  }
  
  // Apply cursor pagination
  let startIndex = 0;
  if (cursor) {
    try {
      const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
      startIndex = notifications.findIndex(n => n.id === decodedCursor.lastId) + 1;
    } catch (e) {
      startIndex = 0;
    }
  }
  
  const paginatedNotifications = notifications.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < notifications.length;
  
  // Generate next cursor
  let nextCursor = null;
  if (hasMore && paginatedNotifications.length > 0) {
    const lastNotification = paginatedNotifications[paginatedNotifications.length - 1];
    nextCursor = Buffer.from(JSON.stringify({ lastId: lastNotification.id })).toString('base64');
  }
  
  // Enrich with actor data
  const users = db.get('users').value() || [];
  const enrichedNotifications = paginatedNotifications.map(notification => ({
    ...notification,
    actor: users.find(u => u.id === notification.actorId)
  }));
  
  console.log(`🔔 Notifications: filter="${filter}", returned=${enrichedNotifications.length}, hasMore=${hasMore}`);
  
  res.json({
    notifications: enrichedNotifications,
    pagination: {
      nextCursor,
      hasMore
    }
  });
});

// GET /api/notifications/unread-count - Get unread notification count
server.get('/api/notifications/unread-count', (req, res) => {
  const db = router.db;
  const notifications = db.get('notifications').value() || [];
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  console.log(`🔔 Unread Count: count=${unreadCount}`);
  
  res.json({ count: unreadCount });
});

// POST /api/notifications/:id/read - Mark notification as read
server.post('/api/notifications/:id/read', (req, res) => {
  const db = router.db;
  const { id } = req.params;
  
  const notifications = db.get('notifications').value() || [];
  const notificationIndex = notifications.findIndex(n => n.id === id);
  
  if (notificationIndex === -1) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  
  // Mark as read
  notifications[notificationIndex].read = true;
  db.set('notifications', notifications).write();
  
  // Enrich with actor data
  const users = db.get('users').value() || [];
  const notification = {
    ...notifications[notificationIndex],
    actor: users.find(u => u.id === notifications[notificationIndex].actorId)
  };
  
  console.log(`✓ Mark Read: notificationId="${id}"`);
  
  res.json({
    success: true,
    notification
  });
});

// POST /api/notifications/mark-all-read - Mark all notifications as read
server.post('/api/notifications/mark-all-read', (req, res) => {
  const db = router.db;
  const notifications = db.get('notifications').value() || [];
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  // Mark all as read
  notifications.forEach(n => n.read = true);
  db.set('notifications', notifications).write();
  
  console.log(`✓ Mark All Read: updated=${unreadCount} notifications`);
  
  res.json({
    success: true,
    updatedCount: unreadCount
  });
});

// ============================================================================
// ANALYTICS ENDPOINTS
// ============================================================================

// Helper function to calculate date range
function getDateRange(period) {
  const now = new Date();
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  return { startDate, endDate: now, days };
}

// Helper function to generate time series data
function generateTimeSeriesData(startDate, days) {
  const data = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    // Generate realistic data with some variation
    const baseViews = 100 + Math.random() * 50;
    const engagementRate = 0.05 + Math.random() * 0.1; // 5-15%
    
    data.push({
      date: date.toISOString().split('T')[0],
      views: Math.floor(baseViews),
      likes: Math.floor(baseViews * engagementRate * 0.6),
      comments: Math.floor(baseViews * engagementRate * 0.25),
      shares: Math.floor(baseViews * engagementRate * 0.15),
      engagement: Math.floor(baseViews * engagementRate)
    });
  }
  return data;
}

// Helper function to calculate metric change
function calculateMetricValue(current, previous) {
  const change = previous === 0 ? 0 : ((current - previous) / previous) * 100;
  return {
    value: current,
    change: Math.round(change * 10) / 10,
    changeDirection: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
  };
}

// GET /api/analytics/overview - Get analytics overview metrics
server.get('/api/analytics/overview', (req, res) => {
  const db = router.db;
  const period = req.query.period || '7d';
  const { startDate, days } = getDateRange(period);
  
  // Get all posts
  const posts = db.get('posts').value() || [];
  const likes = db.get('likes').value() || [];
  const comments = db.get('comments').value() || [];
  
  // Calculate current period metrics
  const currentPosts = posts.filter(p => new Date(p.createdAt) >= startDate);
  const currentLikes = likes.filter(l => new Date(l.createdAt) >= startDate);
  const currentComments = comments.filter(c => new Date(c.createdAt) >= startDate);
  
  // Calculate previous period for comparison
  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - days);
  const prevPosts = posts.filter(p => {
    const date = new Date(p.createdAt);
    return date >= prevStartDate && date < startDate;
  });
  const prevLikes = likes.filter(l => {
    const date = new Date(l.createdAt);
    return date >= prevStartDate && date < startDate;
  });
  const prevComments = comments.filter(c => {
    const date = new Date(c.createdAt);
    return date >= prevStartDate && date < startDate;
  });
  
  // Calculate shares (using shareCount from posts)
  const currentShares = currentPosts.reduce((sum, p) => sum + (p.shareCount || 0), 0);
  const prevShares = prevPosts.reduce((sum, p) => sum + (p.shareCount || 0), 0);
  
  // Estimated views (posts * 10-50 views per post)
  const currentViews = currentPosts.length * 30;
  const prevViews = prevPosts.length * 30;
  
  // Calculate engagement rate
  const currentEngagement = currentLikes.length + currentComments.length + currentShares;
  const prevEngagement = prevLikes.length + prevComments.length + prevShares;
  const currentEngagementRate = currentViews > 0 ? (currentEngagement / currentViews) * 100 : 0;
  const prevEngagementRate = prevViews > 0 ? (prevEngagement / prevViews) * 100 : 0;
  
  // Reach and impressions (estimated)
  const currentReach = Math.floor(currentViews * 0.8);
  const prevReach = Math.floor(prevViews * 0.8);
  const currentImpressions = Math.floor(currentViews * 1.3);
  const prevImpressions = Math.floor(prevViews * 1.3);
  
  const metrics = {
    totalLikes: calculateMetricValue(currentLikes.length, prevLikes.length),
    totalComments: calculateMetricValue(currentComments.length, prevComments.length),
    totalShares: calculateMetricValue(currentShares, prevShares),
    totalViews: calculateMetricValue(currentViews, prevViews),
    engagementRate: calculateMetricValue(currentEngagementRate, prevEngagementRate),
    reach: calculateMetricValue(currentReach, prevReach),
    impressions: calculateMetricValue(currentImpressions, prevImpressions)
  };
  
  console.log(`📊 Analytics Overview: period=${period}, likes=${currentLikes.length}, comments=${currentComments.length}`);
  
  res.json({
    metrics,
    period,
    generatedAt: new Date().toISOString()
  });
});

// GET /api/analytics/engagement - Get engagement time series data
server.get('/api/analytics/engagement', (req, res) => {
  const period = req.query.period || '7d';
  const { startDate, days } = getDateRange(period);
  
  const data = generateTimeSeriesData(startDate, days);
  
  const summary = {
    totalLikes: data.reduce((sum, d) => sum + d.likes, 0),
    totalComments: data.reduce((sum, d) => sum + d.comments, 0),
    totalShares: data.reduce((sum, d) => sum + d.shares, 0),
    totalViews: data.reduce((sum, d) => sum + d.views, 0),
    avgEngagement: Math.floor(data.reduce((sum, d) => sum + d.engagement, 0) / days)
  };
  
  console.log(`📈 Engagement Time Series: period=${period}, days=${days}, avgEngagement=${summary.avgEngagement}`);
  
  res.json({
    data,
    period,
    summary
  });
});

// GET /api/analytics/posts/top - Get top performing posts
server.get('/api/analytics/posts/top', (req, res) => {
  const db = router.db;
  const period = req.query.period || '7d';
  const limit = parseInt(req.query.limit) || 10;
  const { startDate } = getDateRange(period);
  
  const posts = db.get('posts').value() || [];
  const users = db.get('users').value() || [];
  
  // Filter posts by date and calculate engagement
  const topPosts = posts
    .filter(p => new Date(p.createdAt) >= startDate)
    .map(p => {
      const author = users.find(u => u.id === p.authorId) || { name: 'Unknown', avatar: '' };
      const views = (p.likeCount + p.commentCount + p.shareCount) * 10; // Estimate views
      const engagementRate = views > 0 ? ((p.likeCount + p.commentCount + p.shareCount) / views) * 100 : 0;
      
      return {
        id: p.id,
        content: p.content.substring(0, 100) + (p.content.length > 100 ? '...' : ''),
        authorName: author.name,
        authorAvatar: author.avatar,
        likes: p.likeCount || 0,
        comments: p.commentCount || 0,
        shares: p.shareCount || 0,
        views,
        engagementRate: Math.round(engagementRate * 10) / 10,
        createdAt: p.createdAt
      };
    })
    .sort((a, b) => b.engagementRate - a.engagementRate)
    .slice(0, limit);
  
  console.log(`🏆 Top Posts: period=${period}, returned=${topPosts.length}`);
  
  res.json({
    posts: topPosts,
    period,
    total: topPosts.length
  });
});

// GET /api/analytics/activity - Get user activity data
server.get('/api/analytics/activity', (req, res) => {
  const db = router.db;
  const period = req.query.period || '7d';
  const { startDate, days } = getDateRange(period);
  
  const posts = db.get('posts').value() || [];
  const comments = db.get('comments').value() || [];
  const likes = db.get('likes').value() || [];
  
  // Group activity by date
  const activity = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const dayPosts = posts.filter(p => {
      const pDate = new Date(p.createdAt);
      return pDate >= date && pDate < nextDate;
    });
    
    const dayComments = comments.filter(c => {
      const cDate = new Date(c.createdAt);
      return cDate >= date && cDate < nextDate;
    });
    
    const dayLikes = likes.filter(l => {
      const lDate = new Date(l.createdAt);
      return lDate >= date && lDate < nextDate;
    });
    
    activity.push({
      date: dateStr,
      postsCreated: dayPosts.length,
      commentsCreated: dayComments.length,
      likesGiven: dayLikes.length,
      activeMinutes: Math.floor(Math.random() * 60) + 10 // Random 10-70 minutes
    });
  }
  
  const summary = {
    totalPosts: activity.reduce((sum, a) => sum + a.postsCreated, 0),
    totalComments: activity.reduce((sum, a) => sum + a.commentsCreated, 0),
    totalLikes: activity.reduce((sum, a) => sum + a.likesGiven, 0),
    avgActiveMinutes: Math.floor(activity.reduce((sum, a) => sum + a.activeMinutes, 0) / days)
  };
  
  console.log(`⏱️  User Activity: period=${period}, totalPosts=${summary.totalPosts}, avgMinutes=${summary.avgActiveMinutes}`);
  
  res.json({
    activity,
    period,
    summary
  });
});

// GET /api/analytics/export - Export analytics data
server.get('/api/analytics/export', async (req, res) => {
  const period = req.query.period || '7d';
  const format = req.query.format || 'json';
  
  // This would normally aggregate all analytics data
  // For now, return a simple export structure
  
  console.log(`💾 Export Analytics: period=${period}, format=${format}`);
  
  res.json({
    message: 'Export endpoint - use other analytics endpoints to gather data',
    period,
    format,
    exportedAt: new Date().toISOString(),
    endpoints: [
      '/api/analytics/overview',
      '/api/analytics/engagement',
      '/api/analytics/posts/top',
      '/api/analytics/activity'
    ]
  });
});

// Use default router
server.use('/api', router);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`\n🚀 JSON Server is running!`);
  console.log(`\n📡 API Endpoints:`);
  console.log(`   - Feed:            http://localhost:${PORT}/api/feed`);
  console.log(`   - Search:          http://localhost:${PORT}/api/search`);
  console.log(`   - User Profile:    http://localhost:${PORT}/api/users/:userId`);
  console.log(`   - User Posts:      http://localhost:${PORT}/api/users/:userId/posts`);
  console.log(`   - Notifications:   http://localhost:${PORT}/api/notifications`);
  console.log(`   - Unread Count:    http://localhost:${PORT}/api/notifications/unread-count`);
  console.log(`   - Analytics:       http://localhost:${PORT}/api/analytics/*`);
  console.log(`   - Posts:           http://localhost:${PORT}/api/posts`);
  console.log(`   - Users:           http://localhost:${PORT}/api/users`);
  console.log(`   - Comments:        http://localhost:${PORT}/api/comments`);
  console.log(`   - Likes:           http://localhost:${PORT}/api/likes`);
  console.log(`\n💡 Example requests:`);
  console.log(`   - GET  http://localhost:${PORT}/api/feed?limit=10`);
  console.log(`   - GET  http://localhost:${PORT}/api/search?q=hello&filter=all&sort=newest`);
  console.log(`   - GET  http://localhost:${PORT}/api/users/u1`);
  console.log(`   - GET  http://localhost:${PORT}/api/users/u1/posts?limit=10`);
  console.log(`   - GET  http://localhost:${PORT}/api/notifications?filter=unread`);
  console.log(`   - GET  http://localhost:${PORT}/api/notifications/unread-count`);
  console.log(`   - POST http://localhost:${PORT}/api/notifications/:id/read`);
  console.log(`   - POST http://localhost:${PORT}/api/notifications/mark-all-read`);
  console.log(`   - GET  http://localhost:${PORT}/api/analytics/overview?period=7d`);
  console.log(`   - GET  http://localhost:${PORT}/api/analytics/engagement?period=30d`);
  console.log(`   - GET  http://localhost:${PORT}/api/analytics/posts/top?period=7d&limit=10`);
  console.log(`   - GET  http://localhost:${PORT}/api/analytics/activity?period=7d`);
  console.log(`   - POST http://localhost:${PORT}/api/users/u1/follow`);
  console.log(`   - POST http://localhost:${PORT}/api/posts/:postId/like`);
  console.log(`   - POST http://localhost:${PORT}/api/posts/:postId/comments`);
  console.log(`\n`);
});
