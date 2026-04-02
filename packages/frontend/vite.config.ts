import { defineConfig } from 'vite'
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
})
