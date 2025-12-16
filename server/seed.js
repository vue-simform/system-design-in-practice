const fs = require('fs');

// Generate more sample data
function generateSampleData() {
  const users = [];
  const posts = [];
  const comments = [];
  const likes = [];
  const follows = [];

  // Generate 20 users
  for (let i = 1; i <= 20; i++) {
    users.push({
      id: `u${i}`,
      username: `user_${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      avatar: `https://i.pravatar.cc/150?img=${i}`,
      bio: `Software developer and tech enthusiast #${i}`,
      followersCount: Math.floor(Math.random() * 5000),
      followingCount: Math.floor(Math.random() * 1000),
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  // Generate 50 posts
  const sampleContent = [
    'Just shipped a new feature! Really excited about this one.',
    'Working on an interesting problem today. Anyone else dealing with state management complexity?',
    'New blog post is live! Check out my thoughts on modern web development.',
    'Conference talk went great! Thanks to everyone who attended.',
    'Learning something new every day. Today it was about performance optimization.',
    'Open source contribution merged! Feels good to give back to the community.',
    'Code review time. Love seeing how others approach problems.',
    'Debugging is like being a detective. Following the clues...',
    'Just discovered an amazing library that solves our exact problem!',
    'Team meeting insights: Communication is key to successful projects.'
  ];

  const imageUrls = [
    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800',
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800',
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
    'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800'
  ];

  for (let i = 1; i <= 50; i++) {
    const hasImages = Math.random() > 0.5;
    const imageCount = hasImages ? Math.floor(Math.random() * 3) + 1 : 0;
    const mediaUrls = hasImages 
      ? Array.from({ length: imageCount }, () => imageUrls[Math.floor(Math.random() * imageUrls.length)])
      : [];

    posts.push({
      id: `p${i}`,
      authorId: `u${Math.floor(Math.random() * 20) + 1}`,
      content: sampleContent[Math.floor(Math.random() * sampleContent.length)],
      mediaUrls,
      likeCount: Math.floor(Math.random() * 500),
      commentCount: Math.floor(Math.random() * 50),
      shareCount: Math.floor(Math.random() * 20),
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  // Generate 100 comments
  const commentTexts = [
    'Great post!',
    'Thanks for sharing this.',
    'I completely agree with this.',
    'Interesting perspective!',
    'Would love to hear more about this.',
    'This is exactly what I needed.',
    'Nice work!',
    'How did you approach this?',
    'Could you elaborate more on this?',
    'This helped me a lot!'
  ];

  for (let i = 1; i <= 100; i++) {
    comments.push({
      id: `c${i}`,
      postId: `p${Math.floor(Math.random() * 50) + 1}`,
      authorId: `u${Math.floor(Math.random() * 20) + 1}`,
      text: commentTexts[Math.floor(Math.random() * commentTexts.length)],
      parentId: Math.random() > 0.8 ? `c${Math.floor(Math.random() * (i - 1)) + 1}` : null,
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  // Generate 200 likes
  const likeSet = new Set();
  for (let i = 1; i <= 200; i++) {
    const postId = `p${Math.floor(Math.random() * 50) + 1}`;
    const userId = `u${Math.floor(Math.random() * 20) + 1}`;
    const key = `${postId}-${userId}`;
    
    if (!likeSet.has(key)) {
      likeSet.add(key);
      likes.push({
        id: `l${i}`,
        postId,
        userId,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
  }

  // Generate follow relationships
  const followSet = new Set();
  for (let i = 1; i <= 100; i++) {
    const followerId = `u${Math.floor(Math.random() * 20) + 1}`;
    const followedId = `u${Math.floor(Math.random() * 20) + 1}`;
    const key = `${followerId}-${followedId}`;
    
    if (followerId !== followedId && !followSet.has(key)) {
      followSet.add(key);
      follows.push({
        id: `f${i}`,
        followerId,
        followedId,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }
  }

  return { users, posts, comments, likes, follows };
}

// Write to db.json
const data = generateSampleData();
fs.writeFileSync('./db.json', JSON.stringify(data, null, 2));

console.log('✅ Sample data generated!');
console.log(`   - ${data.users.length} users`);
console.log(`   - ${data.posts.length} posts`);
console.log(`   - ${data.comments.length} comments`);
console.log(`   - ${data.likes.length} likes`);
console.log(`   - ${data.follows.length} follows`);
console.log('\n💡 Run "npm start" to start the server');
