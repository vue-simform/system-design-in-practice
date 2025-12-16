import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-service-worker',
      writeBundle() {
        const swSrc = resolve(__dirname, 'public/service-worker.js');
        const swDest = resolve(__dirname, 'dist/service-worker.js');
        if (existsSync(swSrc)) {
          copyFileSync(swSrc, swDest);
          console.log('✅ Service Worker copied to dist/');
        }
      }
    }
  ],
  server: {
    // Proxy API calls to Netlify Functions during development
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
  },
})
