import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  // The Tailwind Vite plugin does the CSS. An empty config stops Vite from loading the coach app's postcss.config.mjs.
  css: { postcss: {} },
  server: { port: 4310 },
})
