import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',  // Important for Electron
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true, // Add this for debugging
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Add this to ensure CSS is properly processed
  css: {
    modules: false,
  },
})