import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/_futurestaff/product-hub-ui/',
  plugins: [react()],
  build: { outDir: 'ui', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
