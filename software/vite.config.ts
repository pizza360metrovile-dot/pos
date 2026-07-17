import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import packageJson from './package.json' // Import package.json to get version

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // Ensures assets load correctly in Electron
  
  // This defines the variable for your React code
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  
  server: {
    port: 3000,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
})