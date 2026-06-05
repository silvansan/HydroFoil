import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import { srsPlaybackProxyPlugin } from './vite-srs-playback-proxy';

const srsPlaybackTarget = process.env.VITE_SRS_PLAYBACK_PROXY ?? 'http://localhost:8080';
const srsApiTarget = process.env.VITE_SRS_API_PROXY ?? 'http://localhost:1985';

export default defineConfig({
  plugins: [react(), srsPlaybackProxyPlugin(srsPlaybackTarget)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hydrofoil/ui-kit': path.resolve(__dirname, '../../packages/ui-kit/src/index.tsx'),
      '@hydrofoil/player': path.resolve(__dirname, '../../packages/player/src/index.ts'),
      '@hydrofoil/shared-types': path.resolve(
        __dirname,
        '../../packages/shared-types/src/index.ts'
      ),
    },
  },
    optimizeDeps: {
    include: ['@hydrofoil/ui-kit', '@hydrofoil/player', '@hydrofoil/shared-types', 'hls.js', 'mpegts.js'],
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
      // Initial manifest (optional prefix for sharing URLs).
      // Fallback for environments that do not load vite-srs-playback-proxy middleware.
      '/srs-media': {
        target: srsPlaybackTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/srs-media/, ''),
      },
      '/srs-api': {
        target: srsApiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/srs-api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        embed: path.resolve(__dirname, 'embed.html'),
      },
    },
  },
});
