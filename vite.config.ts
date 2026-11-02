import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/Music-Project/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'fonts/*.woff2'],
      manifest: {
        id: process.env.NODE_ENV === 'production' ? '/Music-Project/' : '/',
        name: 'Diatonic Chord Practice & Trainer',
        short_name: 'ChordTrainer',
        description: 'Offline-first diatonic chord training and scale degree identification for musicians.',
        theme_color: '#29251F',
        background_color: '#F8F6F1',
        display: 'standalone',
        start_url: process.env.NODE_ENV === 'production' ? '/Music-Project/' : './',
        scope: process.env.NODE_ENV === 'production' ? '/Music-Project/' : './',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  // @ts-ignore
  test: {
    globals: true,
    environment: 'node',
  },
});
