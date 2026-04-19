import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      // Vite soll shared direkt aus dem TypeScript-Quellcode bundlen
      '@cwp/shared': path.resolve(__dirname, '../shared/src/types.ts'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Companion Webpanel',
        short_name: 'CWP',
        description: 'Touch panel for Bitfocus Companion',
        theme_color: '#0f141a',
        background_color: '#0f141a',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // Dev-Proxy: WS-Anfragen an Backend weiterleiten
    proxy: {
      '/api': { target: 'http://localhost:8080' },
    },
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    reportCompressedSize: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Vendor-Chunks trennen → besseres Caching, kleinere Initial-Payload.
        // Function-Form, damit React/Scheduler zuverlässig in react-vendor landen
        // (Object-Form würde React teils ins Main-Bundle hoisten).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
          if (id.includes('@dnd-kit')) return 'dnd-kit'
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    passWithNoTests: true,
  },
})
