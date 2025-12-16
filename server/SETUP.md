# Installation Guide for Mock Backend Server

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Step-by-Step Setup

### 1. Navigate to Server Directory

```bash
cd server
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- `json-server` - Mock REST API server
- `nodemon` - Auto-reload during development

### 3. Choose Your Data

**Option A: Use Pre-populated Data (Recommended for Quick Start)**

The default `db.json` has 4 users and 8 posts ready to use.

```bash
npm start
```

**Option B: Generate More Sample Data**

Generate 20 users, 50 posts, and more relationships:

```bash
npm run seed
npm start
```

### 4. Verify Server is Running

You should see:
```
🚀 JSON Server is running!

📡 API Endpoints:
   - Feed:            http://localhost:3001/api/feed
   - Posts:           http://localhost:3001/api/posts
   - Users:           http://localhost:3001/api/users
```

### 5. Test the API

Open your browser or use curl:

```bash
# Get feed
curl http://localhost:3001/api/feed?limit=5

# Get all users
curl http://localhost:3001/api/users
```

## Development Mode

For auto-reload when you modify `server.js`:

```bash
npm run dev
```

## Troubleshooting

### Error: Port 3001 already in use

**Solution 1: Kill the process**
```bash
# On Linux/Mac
kill -9 $(lsof -ti:3001)

# On Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

**Solution 2: Use different port**
```bash
PORT=3002 npm start
```

Then update your frontend API URL to `http://localhost:3002`

### Error: Module not found

Make sure you installed dependencies:
```bash
npm install
```

### Server starts but no data returned

Check if `db.json` exists and has valid JSON:
```bash
cat db.json
```

If corrupted, regenerate:
```bash
npm run seed
```

## Next Steps

1. Keep the server running in a terminal
2. Open a new terminal for your frontend project
3. Start building your React app!

See `server/README.md` for complete API documentation.
