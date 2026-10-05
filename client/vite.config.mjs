import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = {
  '/graphql': 'http://127.0.0.1:3001',
  '/api': 'http://127.0.0.1:3001',
  '/images': 'http://127.0.0.1:3001',
};

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, strictPort: true, proxy },
  preview: { port: 3000, strictPort: true, proxy },
  build: { outDir: 'build' },
});
