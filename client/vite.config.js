import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 9031,
    proxy: {
      '/backend': {
        target: 'http://server:9030', // Docker network'te backend hostname 'server'
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/backend/, '')
      }
    },
    allowedHosts: ["your-website.com"],
  }
})