import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      host: '88.198.27.9',
    }
  },
  plugins: [
    laravel([
      'resources/js/app.jsx',
      'resources/css/app.css',
    ]),
  ],
});
