// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import laravel from 'laravel-vite-plugin'

export default defineConfig({
  plugins: [
    laravel({
      input: ['resources/js/app.jsx', 'resources/css/app.css'],
      refresh: ['resources/views/**', 'routes/**', 'app/**'],
    }),
    react(),
  ],
  resolve: { alias: { '@': '/resources/js' } },
  server: {
    host: true,       // lauscht auf 0.0.0.0, aber...
    port: 5173,
    strictPort: true,
    cors: true,
    hmr: {
      host: '88.198.27.9', // ...teilt dem Browser diese Host-IP mit
      port: 5173,
      protocol: 'ws',
    },
  },
})
