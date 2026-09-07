import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Quiz Platform",
        short_name: "Quiz",
        description: "Import quizzes, learn offline, and review your results.",
        theme_color: "#171c5b",
        background_color: "#f5f7ff",
        display: "standalone",
        scope: base,
        start_url: base,
        icons: [
          { src: `${base}pwa-64x64.png`, sizes: "64x64", type: "image/png" },
          { src: `${base}pwa-192x192.png`, sizes: "192x192", type: "image/png" },
          { src: `${base}pwa-512x512.png`, sizes: "512x512", type: "image/png" },
          { src: `${base}maskable-icon-512x512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,json}"]
      }
    })
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: ["e2e/**", "node_modules/**"],
    css: true
  }
});
