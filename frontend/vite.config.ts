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
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Group icons together
          if (id.includes('/icons/') || id.endsWith('Icon.js') || id.endsWith('Icon.jsx') || id.endsWith('Icon.tsx')) {
            return 'icons';
          }

          // Group by feature instead of by role
          if (id.includes('Competency_framework')) {
            return 'competency-framework';
          }
          if (id.includes('Job_profiling')) {
            return 'job-profiling';
          }
          if (id.includes('Assessment_management')) {
            return 'assessment-management';
          }
          if (id.includes('Analytics')) {
            return 'analytics';
          }

          // Group common dependencies
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('chart') || id.includes('apex')) {
              return 'vendor-charts';
            }
            if (id.includes('tailwind') || id.includes('css') || id.includes('style')) {
              return 'vendor-styles';
            }
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});

