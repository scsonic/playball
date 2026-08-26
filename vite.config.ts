import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * Monorepo-style multi-page build.
 *
 *   /            → landing page (choose an edition)
 *   /gemini/     → Gemini edition of the catching game
 *   /claude/     → Claude edition of the catching game
 *
 * Both editions share this Vite install, `public/` and the dependency tree,
 * but are otherwise completely independent applications.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        gemini: resolve(__dirname, 'gemini/index.html'),
        claude: resolve(__dirname, 'claude/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
  test: {
    include: ['gemini/src/tests/**/*.test.ts', 'claude/src/tests/**/*.test.ts'],
    environment: 'node',
  },
});
