import { defineConfig } from 'vite';

// Relative base so the build works both on https://ausmc.online/ and on the
// project-pages fallback URL (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1400,
  },
  worker: { format: 'es' },
});
