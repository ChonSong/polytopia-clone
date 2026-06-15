import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3001,
    host: true,
    allowedHosts: ['hex.codeovertcp.com', '.codeovertcp.com'],
  },
  preview: {
    host: true,
    port: 3001,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
