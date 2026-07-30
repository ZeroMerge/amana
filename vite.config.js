import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['amana_favicon.png', 'amana_main_logo.png'],
      manifest: {
        name: 'Amana — Autonomous Evidence Preservation',
        short_name: 'Amana',
        description: 'Fully passive, sensor-driven evidence capture',
        theme_color: '#f3f3f5',
        background_color: '#f3f3f5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'amana_favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'amana_favicon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'amana_favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});
