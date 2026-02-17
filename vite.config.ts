import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0", // Listen on all network interfaces (IPv4 and IPv6)
    port: 8080,
    strictPort: false, // Allow using next available port if 8080 is taken
  },
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force resolution of xlsx to ESM entry (fixes Vercel/Rollup "failed to resolve import")
      xlsx: path.resolve(__dirname, "node_modules/xlsx/xlsx.mjs"),
    },
  },
  optimizeDeps: {
    include: ["xlsx"],
  },
  build: {
    commonjsOptions: {
      include: [/xlsx/, /node_modules/],
    },
  },
}));
