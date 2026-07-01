import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { resolve } from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // TanStack Router file-based routing (must be before react())
    TanStackRouterVite({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    proxy: {
      // Proxy /v1 API calls to the NestJS backend in dev
      '/v1': {
        target: process.env['VITE_API_BASE_URL'] ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
