import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { hlsProxyDevMiddleware } from './src/worker/devProxyMiddleware.ts';

export default defineConfig({
  plugins: [react(), tailwindcss(), hlsProxyDevMiddleware()],
  base: process.env.VITE_BASE ?? '/',
  test: { environment: 'jsdom' },
});