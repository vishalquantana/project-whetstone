import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Project repo is served from a subpath on GitHub Pages; dev/e2e stay at root.
  base: command === 'build' ? '/project-whetstone/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Whetstone',
        short_name: 'Whetstone',
        description: 'Keep the edge AI is dulling. A daily 5-minute gym for the mental muscles that erode under heavy AI use.',
        theme_color: '#0E3D3A',
        background_color: '#E7EBEA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/project-whetstone/',
        scope: '/project-whetstone/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
}));
