import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: path.resolve(__dirname, 'frontend'),
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'frontend/dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-redux': ['redux', 'react-redux'],
          'vendor-maps': ['mapbox-gl'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  }
})
