import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Polyfills needed for simple-peer
      include: ['buffer', 'process', 'stream', 'events'],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    })
  ],
  base: './',
  define: {
    // Required for simple-peer
    global: 'globalThis'
  },
  build: {
    target: 'esnext',
    sourcemap: true
  }
});
