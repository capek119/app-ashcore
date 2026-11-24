import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'docs',       // build directly into docs/ (served by GitHub Pages)
    emptyOutDir: true,    // clean old build files before each build
  },
  base: './',             // relative asset paths — works for any GitHub Pages subpath
  server: {
    proxy: {
      // Local persistence API (see server/); dev-server only, not part of the build.
      '/api': 'http://localhost:4000',
    },
  },
})
