import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { normalizeApiBase } from './src/utils/api.mjs';

const proxy = {
  '/graphql': 'http://127.0.0.1:3001',
  '/api': 'http://127.0.0.1:3001',
  '/images': 'http://127.0.0.1:3001',
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  normalizeApiBase(process.env.VITE_API_URL ?? env.VITE_API_URL);
  return {
  plugins: [react()],
  server: { port: 3000, strictPort: true, proxy },
  preview: { port: 3000, strictPort: true, proxy },
  build: { outDir: 'build' },
  };
});
