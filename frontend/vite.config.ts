import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5200,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:5020',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/xlsx')) return 'spreadsheet';
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/.test(id)) return 'vendor';
          if (id.includes('@reduxjs') || id.includes('react-redux')) return 'redux';
        },
      },
    },
  },
});
