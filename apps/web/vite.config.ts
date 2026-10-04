import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Bind to all interfaces so containers, tunnels and remote previews work.
    host: true,
    port: 5173,
    strictPort: false,
    // Dev servers behind proxies/tunnels (Codespaces, ngrok, e2b previews)
    // arrive with a generated Host header.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Present the API with its own origin. Better Auth validates the
            // Origin header against BETTER_AUTH_URL, and the browser's origin
            // is whatever host the dev server is being viewed on.
            proxyReq.setHeader('origin', API_TARGET);
            proxyReq.setHeader('referer', `${API_TARGET}/`);
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
