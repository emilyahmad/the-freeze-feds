import { defineConfig } from 'vite';

export default defineConfig({
  base: './',               // relative paths, so `npm run build` works on GitHub Pages / itch.io
  server: { port: 5173 },
});
