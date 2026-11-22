import { defineConfig } from 'vite';

export default defineConfig({
  base: './',               // relative paths, so `npm run build` works on GitHub Pages / itch.io
  server: { port: 5173, strictPort: true },   // fail if 5173 is taken, rather than quietly moving to 5174 while an old server keeps 5173
  build: { target: 'es2022' }, // main.js awaits the model load at the top level
});
