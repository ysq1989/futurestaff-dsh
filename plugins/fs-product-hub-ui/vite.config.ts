import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  base: '/_futurestaff/product-hub-ui/',
  plugins: [react()],
  resolve: {
    alias: {
      '@futurestaff/fs-platform-access/client': fileURLToPath(
        new URL('../fs-platform-access/src/client/index.tsx', import.meta.url),
      ),
    },
  },
  build: { outDir: 'ui', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
