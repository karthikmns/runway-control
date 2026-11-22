import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: 'web',
  publicDir: '../public',
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
