import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // simple-peer (via readable-stream) expects Node builtins like `events`.
    nodePolyfills({
      include: ['events', 'buffer', 'process', 'stream']
    })
  ],
  base: '/8-ball-pool/',
})

