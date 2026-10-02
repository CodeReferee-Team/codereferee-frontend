import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // BE(Spring Boot)에 CORS 설정이 없으므로 개발 중에는 같은 오리진으로 프록시한다.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
