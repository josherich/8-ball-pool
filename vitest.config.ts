import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@dimforge/rapier3d-compat': '@dimforge/rapier3d-compat/rapier.es.js',
    },
  },
});
