// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import laravel from 'laravel-vite-plugin'

export default defineConfig({
  plugins: [laravel({ input: ['resources/js/app.jsx'], refresh: true }), react()],
  resolve: { alias: { '@': '/resources/js' } },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Wichtig: 8080 als erlaubte Origin
    cors: {
      origin: ['http://88.198.27.9:8080', 'http://88.198.27.9'],
      credentials: true,
    },
    origin: 'http://88.198.27.9:5173',
    hmr: { host: '88.198.27.9', protocol: 'ws', port: 5173 },
  },
})
