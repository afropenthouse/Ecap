import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  css: {
    devSourcemap: true,
  },
  build: {
    cssMinify: 'lightningcss',
    // Let Rollup preserve dependency initialization order. Grouping React,
    // icons and application features manually created circular startup chunks.
    // Existing lazy routes still provide automatic code splitting.
    chunkSizeWarningLimit: 1000
  }
});

