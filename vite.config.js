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
})
