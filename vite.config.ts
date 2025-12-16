import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to Netlify Functions during development
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
