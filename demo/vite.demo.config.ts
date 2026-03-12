import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  base: isProd ? '/sdk-playground/' : '/',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: resolve(__dirname, '../demo-dist'),
    emptyOutDir: true,
  },
})
